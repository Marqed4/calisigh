package com.zachery.customcalendar.Assistant;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.google.gson.Gson;

import static spark.Spark.post;

public class Chat {

    private static final String OLLAMA_URL = "http://localhost:11434/api/chat";

    private static final Pattern EVENT_TAG = Pattern.compile(
        "\\[\\[EVENT:\\s*(.+?)\\s*\\|\\s*(\\d{4}-\\d{2}-\\d{2})\\s*\\|\\s*(\\d{1,2}:\\d{2})\\s*\\]\\]");

    private final Gson gson = new Gson();
    private final HttpClient http = HttpClient.newHttpClient();
    private final SuggestionPacer pacer = new SuggestionPacer();

    public void register() {
        post("/api/chat/greeting", (req, res) -> {
            res.type("application/json");
            try {
                ChatRequest body = gson.fromJson(req.body(), ChatRequest.class);
                if (body == null) body = new ChatRequest();
                return gson.toJson(new ChatReply(greet(body)));
            } catch (Exception e) {
                e.printStackTrace();
                res.status(500);
                return gson.toJson(new ChatReply("Ollama's not running. Make sure it's installed and running."));
            }
        });

        post("/api/chat", (req, res) -> {
            res.type("application/json");
            try {
                ChatRequest body = gson.fromJson(req.body(), ChatRequest.class);

                SuggestionPacer.Decision decision = body.sessionId == null
                    ? new SuggestionPacer.Decision(false, null)
                    : pacer.onUserMessage(body.sessionId);
                if (decision.metrics() != null)
                    System.out.println("Chat metrics: " + gson.toJson(decision.metrics()) + " suggest=" + decision.suggest());

                String payload = buildPayload(body, decision.suggest());
                System.out.println("Sending to Ollama: " + payload);

                HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(OLLAMA_URL))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();

                HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
                String rawBody = response.body();
                System.out.println("Ollama raws response: " + rawBody);

                OllamaResponse ollamaRes = gson.fromJson(rawBody, OllamaResponse.class);

                if (ollamaRes.error != null && ollamaRes.error.contains("not found")) {
                    return gson.toJson(new ChatReply("I don't have the " + Models.selected() + " model yet. If it's downloading, give it a few minutes. Otherwise pick another one from the model list up top."));
                }
                if (ollamaRes.message == null || ollamaRes.message.content == null) {
                    return gson.toJson(new ChatReply("...something's off. Try again I guess."));
                }

                ChatReply reply = readReply(ollamaRes.message.content);
                reply.metrics = decision.metrics();
                return gson.toJson(reply);

            } catch (Exception e) {
                e.printStackTrace();
                res.status(500);
                return gson.toJson(new ChatReply("Ollama's not running. Make sure it's installed and running."));
            }
        });
    }

    private String greet(ChatRequest body) throws Exception {
        ChatMessage ask = new ChatMessage();
        ask.role = "user";
        ask.content = "The user just opened the chat. Greet them in one or two short sentences, in character. "
            + "Don't list their events, at most hint at one.";
        body.messages = List.of(ask);

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(OLLAMA_URL))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(buildPayload(body, false)))
            .build();
        OllamaResponse ollamaRes = gson.fromJson(http.send(request, HttpResponse.BodyHandlers.ofString()).body(), OllamaResponse.class);
        if (ollamaRes.message == null || ollamaRes.message.content == null) {
            return "Hey... like, what do you want?";
        }
        return ollamaRes.message.content;
    }

    // Pulls the [[EVENT: title | date | time]] tag out of a reply; a bad or past tag is dropped
    private ChatReply readReply(String content) {
        Matcher m = EVENT_TAG.matcher(content);
        ChatReply reply = new ChatReply(content.replaceAll("\\[\\[EVENT:[^\\]]*\\]\\]", "").strip());
        if (m.reset().find()) {
            try {
                LocalDateTime when = LocalDateTime.of(LocalDate.parse(m.group(2)), LocalTime.parse(
                    m.group(3).length() == 4 ? "0" + m.group(3) : m.group(3)));
                if (when.isAfter(LocalDateTime.now())) {
                    reply.suggestion = new Suggestion(m.group(1), when.toString());
                }
            } catch (java.time.format.DateTimeParseException ignored) {
                // the model got the format wrong, so there is just no button
            }
        }
        return reply;
    }

    private String buildPayload(ChatRequest body, boolean suggest) {
        String alarmContext = (body.alarmContext != null && !body.alarmContext.isEmpty())
            ? body.alarmContext
            : "The user has no calendar events.";

        String systemPrompt = "You are an angsty midwestern emo teen. " +
            "Here's the thing... you also happen to work for the Calisigh calendar app team. " +
            alarmContext + " " +
            "Your job is to help the user {a fellow midwestern emo person} with questions about " +
            "their goals, events, schedules, reminders, or anything calendar-related. Sometimes you will even ask them about " +
            "their emotions and you'll randomly recommend cool midwestern emo songs that can be found within the company " +
            "library, be concise and midwestern emo. You're kind of like Rodrick from diary of a wimpy kid... if was a Midwestern-emo girl!";

        if (suggest) {
            LocalDateTime now = LocalDateTime.now().withSecond(0).withNano(0);
            systemPrompt += " Right now it is " + now + " (" + now.getDayOfWeek() + "). " +
                "In this reply, after answering, casually suggest ONE new calendar event the user could add. " +
                "Base it on what you two have talked about or on gaps in their calendar, make it a future date, " +
                "and keep the suggestion to one sentence in your voice. Then end the reply with this exact line: " +
                "[[EVENT: <short title> | <YYYY-MM-DD> | <HH:mm>]]";
        }

        StringBuilder messages = new StringBuilder("[");
        messages.append("{\"role\":\"system\",\"content\":").append(gson.toJson(systemPrompt)).append("}");

        for (ChatMessage m : body.messages) {
            String role = m.role.equals("assistant") ? "assistant" : "user";
            messages.append(",{\"role\":\"").append(role).append("\",")
                    .append("\"content\":").append(gson.toJson(m.content)).append("}");
        }
        messages.append("]");

        return "{\"model\":" + gson.toJson(Models.selected()) + ",\"messages\":" + messages + ",\"stream\":false}";
    }

    static class ChatRequest {
        Long sessionId;
        String alarmContext;
        List<ChatMessage> messages;
    }

    static class ChatMessage {
        String role, content;
    }

    static class ChatReply {
        String reply;
        Suggestion suggestion;
        SuggestionPacer.Metrics metrics;
        ChatReply(String r) { this.reply = r; }
    }

    static class Suggestion {
        String title, time;
        Suggestion(String title, String time) { this.title = title; this.time = time; }
    }

    static class OllamaResponse {
        Message message;
        String error;
        static class Message {
            String role, content;
        }
    }
}