package com.zachery.customcalendar.Assistant;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Pattern;

import com.google.gson.Gson;
import com.zachery.customcalendar.Storage.Database;

import static spark.Spark.get;
import static spark.Spark.post;

/* Which Ollama model the chat uses, plus listing and downloading models */
public class Models {

    public static final String DEFAULT_MODEL = "llama3.2";

    private static final Logger LOGGER = Logger.getLogger(Models.class.getName());
    private static final String OLLAMA = "http://localhost:11434";
    private static final String SETTING = "chatModel";
    private static final Pattern VALID_NAME = Pattern.compile("[A-Za-z0-9._:/-]{1,100}");

    private static final Gson gson = new Gson();
    private static final HttpClient http = HttpClient.newHttpClient();

    private static final Set<String> pulling = ConcurrentHashMap.newKeySet();
    private static final Map<String, String> pullErrors = new ConcurrentHashMap<>();

    /* The model chat requests use. Unset means llama3.2, or whatever is installed if that is not. */
    public static String selected() {
        try {
            String saved = Database.get().getSetting(SETTING);
            if (saved != null && !saved.isBlank()) return saved;

            List<String> installed = installed();
            if (!installed.isEmpty() && installed.stream().noneMatch(n -> same(n, DEFAULT_MODEL))) {
                Database.get().setSetting(SETTING, installed.get(0));
                return installed.get(0);
            }
        } catch (Exception e) {
            LOGGER.log(Level.WARNING, "Could not read the chat model setting", e);
        }
        return DEFAULT_MODEL;
    }

    /* "llama3.2" and "llama3.2:latest" are the same model */
    static boolean same(String a, String b) {
        return strip(a).equalsIgnoreCase(strip(b));
    }

    private static String strip(String name) {
        return name.endsWith(":latest") ? name.substring(0, name.length() - 7) : name;
    }

    private static List<String> installed() throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(OLLAMA + "/api/tags"))
            .timeout(Duration.ofSeconds(3))
            .GET()
            .build();
        Tags tags = gson.fromJson(http.send(request, HttpResponse.BodyHandlers.ofString()).body(), Tags.class);
        List<String> out = new ArrayList<>();
        if (tags != null && tags.models != null)
            for (Tag t : tags.models) out.add(t.name);
        return out;
    }

    private static void startPull(String name) {
        if (!pulling.add(name)) return;
        pullErrors.remove(name);
        Thread t = new Thread(() -> {
            try {
                String payload = "{\"model\":" + gson.toJson(name) + ",\"stream\":false}";
                HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(OLLAMA + "/api/pull"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();
                String raw = http.send(request, HttpResponse.BodyHandlers.ofString()).body();
                PullResult result = gson.fromJson(raw, PullResult.class);
                if (result != null && result.error != null) pullErrors.put(name, result.error);
            } catch (Exception e) {
                LOGGER.log(Level.WARNING, "Pulling " + name + " failed", e);
                pullErrors.put(name, "Ollama is not running.");
            } finally {
                pulling.remove(name);
            }
        }, "pull-" + name);
        t.setDaemon(true);
        t.start();
    }

    public void register() {
        get("/api/chat/models", (req, res) -> {
            res.type("application/json");
            List<String> names;
            try {
                names = installed();
            } catch (Exception e) {
                names = List.of();
            }
            return gson.toJson(new ModelList(selected(), names, new ArrayList<>(pulling), pullErrors));
        });

        post("/api/chat/model", (req, res) -> {
            res.type("application/json");
            Named body = gson.fromJson(req.body(), Named.class);
            if (body == null || body.name == null || !VALID_NAME.matcher(body.name).matches()) {
                res.status(400);
                return "{\"error\":\"That is not a model name.\"}";
            }
            Database.get().setSetting(SETTING, body.name);
            return gson.toJson(new Named(body.name));
        });

        post("/api/chat/models/pull", (req, res) -> {
            res.type("application/json");
            Named body = gson.fromJson(req.body(), Named.class);
            if (body == null || body.name == null || !VALID_NAME.matcher(body.name).matches()) {
                res.status(400);
                return "{\"error\":\"That is not a model name.\"}";
            }
            startPull(body.name);
            return gson.toJson(new Named(body.name));
        });
    }

    static class Named {
        String name;
        Named(String name) { this.name = name; }
    }

    static class ModelList {
        String selected;
        List<String> installed;
        List<String> pulling;
        Map<String, String> errors;
        ModelList(String selected, List<String> installed, List<String> pulling, Map<String, String> errors) {
            this.selected = selected;
            this.installed = installed;
            this.pulling = pulling;
            this.errors = errors;
        }
    }

    static class Tags {
        List<Tag> models;
    }

    static class Tag {
        String name;
    }

    static class PullResult {
        String error;
    }
}
