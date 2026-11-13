package com.zachery.customcalendar.Assistant;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import com.google.gson.Gson;
import com.google.gson.JsonParseException;
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

    /* Models being downloaded right now, with how far along each one is (0 to 99) */
    private static final Map<String, Integer> pulling = new ConcurrentHashMap<>();
    private static final Map<String, String> pullErrors = new ConcurrentHashMap<>();

    /* Whether each installed model can read pictures, so /api/show is only asked once per model */
    private static final Map<String, Boolean> visionCache = new ConcurrentHashMap<>();

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

    /* Ollama lists what each model can do (completion, vision and so on). Null means it did not say. */
    private static Boolean canSeeImages(String name) {
        try {
            String payload = "{\"model\":" + gson.toJson(name) + "}";
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(OLLAMA + "/api/show"))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(5))
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) return null;

            Show show = gson.fromJson(response.body(), Show.class);
            if (show == null || show.capabilities == null) return null;
            return show.capabilities.contains("vision");
        } catch (Exception e) {
            LOGGER.log(Level.FINE, "Could not ask Ollama what " + name + " can do", e);
            return null;
        }
    }

    /* The installed models that can read pictures. Null when Ollama could not say for every one
       (an older Ollama has no capabilities list), so the app falls back to guessing from the name. */
    private static List<String> visionModels(List<String> names, String selected) {
        if (names.isEmpty()) return null;

        List<String> out = new ArrayList<>();
        for (String n : names) {
            Boolean sees = visionCache.get(n);
            if (sees == null) {
                sees = canSeeImages(n);
                if (sees == null) return null;
                visionCache.put(n, sees);
            }
            if (sees) out.add(n);
        }

        /* the saved name may be "llama3.2" while Ollama lists "llama3.2:latest", so list both spellings */
        for (String n : new ArrayList<>(out))
            if (!n.equals(selected) && same(n, selected)) out.add(selected);
        return out;
    }

    /* One number for the whole download: Ollama reports each layer on its own, so add the layers up */
    static int percentOf(Map<String, long[]> layers) {
        long total = 0;
        long done = 0;
        for (long[] layer : layers.values()) {
            total += layer[0];
            done += layer[1];
        }
        if (total <= 0) return 0;
        return (int) Math.min(99, done * 100 / total);
    }

    private static void startPull(String name) {
        if (pulling.putIfAbsent(name, 0) != null) return;
        pullErrors.remove(name);
        visionCache.remove(name);
        Thread t = new Thread(() -> {
            try {
                String payload = "{\"model\":" + gson.toJson(name) + ",\"stream\":true}";
                HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(OLLAMA + "/api/pull"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();

                Map<String, long[]> layers = new HashMap<>();
                try (Stream<String> lines = http.send(request, HttpResponse.BodyHandlers.ofLines()).body()) {
                    Iterator<String> it = lines.iterator();
                    while (it.hasNext()) {
                        String line = it.next();
                        if (line.isBlank()) continue;

                        PullLine p;
                        try {
                            p = gson.fromJson(line, PullLine.class);
                        } catch (JsonParseException e) {
                            continue;
                        }
                        if (p == null) continue;

                        if (p.error != null) {
                            pullErrors.put(name, p.error);
                            break;
                        }
                        if (p.digest != null && p.total > 0) {
                            layers.put(p.digest, new long[] { p.total, p.completed });
                            pulling.put(name, percentOf(layers));
                        }
                    }
                }
            } catch (Exception e) {
                LOGGER.log(Level.WARNING, "Pulling " + name + " failed", e);
                pullErrors.put(name, "Ollama is not running.");
            } finally {
                pulling.remove(name);
                visionCache.remove(name);
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
            String selected = selected();
            List<PullItem> downloading = new ArrayList<>();
            pulling.forEach((n, percent) -> downloading.add(new PullItem(n, percent)));
            return gson.toJson(new ModelList(selected, names, downloading, pullErrors, visionModels(names, selected)));
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

    static class PullItem {
        String name;
        int percent;
        PullItem(String name, int percent) {
            this.name = name;
            this.percent = percent;
        }
    }

    /* vision stays null (and is left out of the JSON) when Ollama could not say which models see pictures */
    static class ModelList {
        String selected;
        List<String> installed;
        List<PullItem> pulling;
        Map<String, String> errors;
        List<String> vision;
        ModelList(String selected, List<String> installed, List<PullItem> pulling, Map<String, String> errors, List<String> vision) {
            this.selected = selected;
            this.installed = installed;
            this.pulling = pulling;
            this.errors = errors;
            this.vision = vision;
        }
    }

    static class Tags {
        List<Tag> models;
    }

    static class Tag {
        String name;
    }

    static class Show {
        List<String> capabilities;
    }

    static class PullLine {
        String status;
        String digest;
        String error;
        long total;
        long completed;
    }
}
