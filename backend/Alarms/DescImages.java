package com.zachery.customcalendar.Alarms;

import java.io.File;
import java.nio.file.Files;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import com.google.gson.reflect.TypeToken;
import com.zachery.customcalendar.Http.Json;
import com.zachery.customcalendar.Http.Json.Message;
import com.zachery.customcalendar.Http.Routes;
import com.zachery.customcalendar.Http.Routes.BadRequest;
import com.zachery.customcalendar.Storage.Database;
import com.zachery.customcalendar.Storage.SystemDirectory;

import static spark.Spark.get;
import static spark.Spark.post;
import static spark.Spark.put;

/**
 * Pictures pasted into an event's description. The picture files live in Images/Uploads and the list per
 * event lives in the settings table (alarm id to stored paths), so the alarms table is never touched.
 * The API hands out and accepts absolute paths, like the cell picture does.
 */
public class DescImages {

    private static final String KEY = "descImages";
    private static final int MAX_IMAGES = 20;
    private static final long MAX_BYTES = 10L * 1024 * 1024;
    private static final AtomicInteger COUNTER = new AtomicInteger();

    private static final Map<String, String> EXTENSIONS = Map.of(
        "image/png", "png", "image/jpeg", "jpg", "image/gif", "gif", "image/webp", "webp");

    static class Upload {
        String data, type;
    }

    record Saved(String path) {}

    private static Map<String, List<String>> load(Database db) throws SQLException {
        String json = db.getSetting(KEY);
        if (json == null) return new LinkedHashMap<>();
        Map<String, List<String>> map = Json.GSON.fromJson(json, new TypeToken<LinkedHashMap<String, List<String>>>() {}.getType());
        return map == null ? new LinkedHashMap<>() : map;
    }

    /** Drops the picture list of a deleted alarm. The picture files themselves stay on disk. */
    static void forget(long id) throws SQLException {
        Database db = Database.get();
        synchronized (DescImages.class) {
            Map<String, List<String>> map = load(db);
            if (map.remove(String.valueOf(id)) != null)
                db.setSetting(KEY, Json.GSON.toJson(map));
        }
    }

    private static String idOf(spark.Request req) {
        try { return String.valueOf(Long.parseLong(req.params(":id"))); }
        catch (NumberFormatException e) { throw new BadRequest("Alarm id must be a number."); }
    }

    public void register() {
        post("/api/images", Routes.json("POST /api/images", (req, res) -> {
            Upload up = Json.GSON.fromJson(req.body(), Upload.class);
            if (up == null || up.data == null || up.data.isBlank()) throw new BadRequest("Send {data, type}.");

            String ext = up.type == null ? null : EXTENSIONS.get(up.type.toLowerCase());
            if (ext == null) throw new BadRequest("Pictures must be png, jpg, gif or webp.");

            byte[] bytes;
            try { bytes = Base64.getDecoder().decode(up.data); }
            catch (IllegalArgumentException e) { throw new BadRequest("The picture data is not valid."); }
            if (bytes.length == 0 || bytes.length > MAX_BYTES) throw new BadRequest("Pictures must be under 10 MB.");

            File dest = SystemDirectory.Directory("Images/Uploads/" + System.currentTimeMillis() + "-" + COUNTER.incrementAndGet() + "-pasted." + ext);
            dest.getParentFile().mkdirs();
            Files.write(dest.toPath(), bytes);
            return new Saved(Database.imageToApi(Database.toStoredPath(dest)));
        }));

        get("/api/alarms/:id/images", Routes.json("GET /api/alarms/:id/images", (req, res) -> {
            List<String> stored = load(Database.get()).getOrDefault(idOf(req), List.of());
            List<String> out = new ArrayList<>();
            for (String path : stored)
                if (Database.fromStoredPath(path).isFile()) out.add(Database.imageToApi(path));
            return out;
        }));

        put("/api/alarms/:id/images", Routes.json("PUT /api/alarms/:id/images", (req, res) -> {
            String id = idOf(req);
            List<String> paths = Json.GSON.fromJson(req.body(), new TypeToken<List<String>>() {}.getType());
            if (paths == null) throw new BadRequest("Send a list of picture paths.");
            if (paths.size() > MAX_IMAGES) throw new BadRequest("Up to " + MAX_IMAGES + " pictures.");

            List<String> stored = new ArrayList<>();
            for (String path : paths) {
                if (path == null || path.isBlank()) continue;
                String relative = Database.toStoredPath(new File(path));
                // only pictures Calisigh itself saved, never an arbitrary file on the computer
                if (new File(relative).isAbsolute() || !Database.fromStoredPath(relative).isFile())
                    throw new BadRequest("Pictures must be ones Calisigh saved.");
                stored.add(relative);
            }

            Database db = Database.get();
            synchronized (DescImages.class) {
                Map<String, List<String>> map = load(db);
                if (stored.isEmpty()) map.remove(id); else map.put(id, stored);
                db.setSetting(KEY, Json.GSON.toJson(map));
            }
            return new Message("Saved.");
        }));
    }
}