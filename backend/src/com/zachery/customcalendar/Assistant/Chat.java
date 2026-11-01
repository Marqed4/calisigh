package com.zachery.customcalendar.Assistant;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDateTime;
import java.util.List;

import com.google.gson.Gson;

import static spark.Spark.post;

public class Chat {

    private static final String OLLAMA_URL = "http://localhost:11434/api/chat";

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

    private ChatReply readReply(String content) {
        EventTag.Result result = EventTag.extract(content, LocalDateTime.now());
        ChatReply reply = new ChatReply(result.text());
        reply.suggestion = result.proposal();
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
        systemPrompt += " Rules: only talk about events that appear in the calendar information above, except new events the user asks you to create. " +
            "Never make up events, times or dates, and never list events from another day when asked about one day. " +
            "If there is nothing on a day, say so. Write plain text with no markdown, no asterisks and no bullet symbols, " +
            "and keep replies short.";

        systemPrompt += EventTag.instructions(LocalDateTime.now(), suggest);

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
        EventTag.Proposal suggestion;
        SuggestionPacer.Metrics metrics;
        ChatReply(String r) { this.reply = r; }
    }

    static class OllamaResponse {
        Message message;
        String error;
        static class Message {
            String role, content;
        }
    }
}