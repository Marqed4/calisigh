package com.zachery.customcalendar.Alarms;

import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.google.gson.JsonParseException;
import com.google.gson.reflect.TypeToken;
import com.zachery.customcalendar.Http.Json;
import com.zachery.customcalendar.Http.Json.Message;
import com.zachery.customcalendar.Http.Routes;
import com.zachery.customcalendar.Http.Routes.BadRequest;
import com.zachery.customcalendar.Storage.Database;

import static spark.Spark.get;
import static spark.Spark.put;

/**
 * Bookmarks and event presets. Both live in the settings table, so the alarms table is never touched:
 * a mark is {bookmarked, preset} keyed by alarm id, a preset is the default look and text for a kind of event.
 */
public class EventMarks {

    private static final String MARKS_KEY = "eventMarks";
    private static final String PRESETS_KEY = "presets";
    private static final int MAX_PRESETS = 30;
    private static final int MAX_TEXT = 2000;

    static class Mark {
        boolean bookmarked;
        String preset = "";
    }

    static class Preset {
        String id, name, color, font, title, desc, time;   // time is "HH:MM", or "" for none
    }

    static class MarksAndPresets {
        Map<String, Mark> marks;
        List<Preset> presets;
    }

    private static Map<String, Mark> loadMarks(Database db) throws SQLException {
        String json = db.getSetting(MARKS_KEY);
        if (json == null) return new LinkedHashMap<>();
        Map<String, Mark> marks = Json.GSON.fromJson(json, new TypeToken<LinkedHashMap<String, Mark>>() {}.getType());
        return marks == null ? new LinkedHashMap<>() : marks;
    }

    private static List<Preset> loadPresets(Database db) throws SQLException {
        String json = db.getSetting(PRESETS_KEY);
        if (json == null) return List.of();
        List<Preset> presets = Json.GSON.fromJson(json, new TypeToken<List<Preset>>() {}.getType());
        return presets == null ? List.of() : presets;
    }

    /** Drops the mark of a deleted alarm so the settings entry doesn't pile up. */
    static void forget(long id) throws SQLException {
        Database db = Database.get();
        synchronized (EventMarks.class) {
            Map<String, Mark> marks = loadMarks(db);
            if (marks.remove(String.valueOf(id)) != null)
                db.setSetting(MARKS_KEY, Json.GSON.toJson(marks));
        }
    }

    private static String clip(String text) {
        if (text == null) return "";
        return text.length() > MAX_TEXT ? text.substring(0, MAX_TEXT) : text;
    }

    public void register() {
        get("/api/marks", Routes.json("GET /api/marks", (req, res) -> {
            Database db = Database.get();
            MarksAndPresets out = new MarksAndPresets();
            out.marks = loadMarks(db);
            out.presets = loadPresets(db);
            return out;
        }));

        // a mark with no bookmark and no preset is dropped, so the map only holds what matters
        put("/api/marks/:id", Routes.json("PUT /api/marks/:id", (req, res) -> {
            long id;
            try { id = Long.parseLong(req.params(":id")); }
            catch (NumberFormatException e) { throw new BadRequest("Alarm id must be a number."); }

            Mark mark = Json.GSON.fromJson(req.body(), Mark.class);
            if (mark == null) throw new BadRequest("Send {bookmarked, preset}.");

            Database db = Database.get();
            synchronized (EventMarks.class) {
                Map<String, Mark> marks = loadMarks(db);
                if (mark.bookmarked || (mark.preset != null && !mark.preset.isEmpty())) {
                    if (mark.preset == null) mark.preset = "";
                    marks.put(String.valueOf(id), mark);
                } else {
                    marks.remove(String.valueOf(id));
                }
                db.setSetting(MARKS_KEY, Json.GSON.toJson(marks));
            }
            return new Message("Saved.");
        }));

        put("/api/presets", Routes.json("PUT /api/presets", (req, res) -> {
            List<Preset> presets;
            try {
                presets = Json.GSON.fromJson(req.body(), new TypeToken<List<Preset>>() {}.getType());
            } catch (JsonParseException e) {
                throw new BadRequest("Presets must be a list.");
            }
            if (presets == null) throw new BadRequest("Presets must be a list.");
            if (presets.size() > MAX_PRESETS) throw new BadRequest("Up to " + MAX_PRESETS + " presets.");

            for (Preset p : presets) {
                if (p.id == null || p.id.isBlank()) throw new BadRequest("Every preset needs an id.");
                p.name = clip(p.name);
                p.color = p.color == null ? "" : p.color;
                p.font = clip(p.font);
                p.title = clip(p.title);
                p.desc = clip(p.desc);
                p.time = p.time != null && p.time.matches("\\d{2}:\\d{2}") ? p.time : "";
            }
            Database.get().setSetting(PRESETS_KEY, Json.GSON.toJson(presets));
            return new Message("Saved.");
        }));
    }
}