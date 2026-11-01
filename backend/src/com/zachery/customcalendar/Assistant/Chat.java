package com.zachery.customcalendar;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

import com.google.gson.Gson;

import static spark.Spark.post;

public class Chat {

    private static final String OLLAMA_URL = "http://localhost:11434/api/chat";
    private static final String MODEL = "llama3.2";

    private final Gson gson = new Gson();
    private final HttpClient http = HttpClient.newHttpClient();

    public void register() {
        post("/api/chat", (req, res) -> {
            res.type("application/json");
            try {
                ChatRequest body = gson.fromJson(req.body(), ChatRequest.class);

                String payload = buildPayload(body);
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

                if (ollamaRes.message == null || ollamaRes.message.content == null) {
                    return gson.toJson(new ChatReply("...something's off. Try again I guess."));
                }

                return gson.toJson(new ChatReply(ollamaRes.message.content));

            } catch (Exception e) {
                e.printStackTrace();
                res.status(500);
                return gson.toJson(new ChatReply("Ollama's not running. Make sure it's installed and running."));
            }
        });
    }

    private String buildPayload(ChatRequest body) {
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

        StringBuilder messages = new StringBuilder("[");
        messages.append("{\"role\":\"system\",\"content\":").append(gson.toJson(systemPrompt)).append("}");

        for (ChatMessage m : body.messages) {
            String role = m.role.equals("assistant") ? "assistant" : "user";
            messages.append(",{\"role\":\"").append(role).append("\",")
                    .append("\"content\":").append(gson.toJson(m.content)).append("}");
        }
        messages.append("]");

        return "{\"model\":\"" + MODEL + "\",\"messages\":" + messages + ",\"stream\":false}";
    }

    static class ChatRequest {
        String alarmContext;
        List<ChatMessage> messages;
    }

    static class ChatMessage {
        String role, content;
    }

    static class ChatReply {
        String reply;
        ChatReply(String r) { this.reply = r; }
    }

    static class OllamaResponse {
        Message message;
        static class Message {
            String role, content;
        }
    }
}