package com.zachery.customcalendar.Alarms;

import java.io.File;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;

import com.zachery.customcalendar.Http.Json;
import com.zachery.customcalendar.Http.Json.Message;
import com.zachery.customcalendar.Http.Routes;
import com.zachery.customcalendar.Http.Routes.BadRequest;
import com.zachery.customcalendar.Storage.Database;
import com.zachery.customcalendar.Storage.SystemDirectory;

import static spark.Spark.delete;
import static spark.Spark.get;
import static spark.Spark.post;
import static spark.Spark.put;

public class AlarmRoutes {

    private static final int DEFAULT_SNOOZE_MINUTES = 10;
    private static final int MAX_SNOOZE_MINUTES = 120;

    private final DateAlarm dateAlarm;

    public AlarmRoutes(DateAlarm dateAlarm) {
        this.dateAlarm = dateAlarm;
    }

    static class AlarmRequest {
        Long id;
        String time, title, desc;
        String imageSource;   // path of a picture to attach
        Boolean clearImage;   // PUT only: drop the current picture
    }

    // the id lets the caller attach a bookmark or preset to the alarm it just made
    record Created(String message, long id) {}

    private static AlarmRequest read(spark.Request req) {
        return Json.GSON.fromJson(req.body(), AlarmRequest.class);
    }

    // "" when there is no picture, otherwise the picture's path inside the Calisigh folder
    private static String storedImage(String sourcePath) {
        if (sourcePath == null || sourcePath.isBlank()) return "";
        return Database.toStoredPath(SystemDirectory.importImage(new File(sourcePath)));
    }

    private static LocalDate parseDate(String text) {
        return text == null || text.isBlank() ? null : LocalDate.parse(text);
    }

    private static Message removedMessage(spark.Response res, boolean removed) {
        if (!removed) res.status(404);
        return new Message(removed ? "Alarm removed!" : "Alarm not found.");
    }

    // the "firing", "snooze" and "missed" routes go first so they are never read as an alarm id
    public void register() {
        get("/api/alarms/firing", Routes.json("GET /api/alarms/firing", (req, res) -> FiringState.snapshot()));

        delete("/api/alarms/firing", Routes.json("DELETE /api/alarms/firing", (req, res) -> {
            FiringState.clear();
            return new Message("Firing cleared.");
        }));

        // snoozes whatever is ringing right now, ?minutes=10 by default
        post("/api/alarms/snooze", Routes.json("POST /api/alarms/snooze", (req, res) -> {
            int minutes = DEFAULT_SNOOZE_MINUTES;
            String q = req.queryParams("minutes");
            if (q != null && !q.isBlank()) {
                try { minutes = Integer.parseInt(q.trim()); }
                catch (NumberFormatException e) { throw new BadRequest("minutes must be a number."); }
            }
            if (minutes < 1 || minutes > MAX_SNOOZE_MINUTES)
                throw new BadRequest("minutes must be between 1 and " + MAX_SNOOZE_MINUTES + ".");

            boolean snoozed = dateAlarm.snooze(minutes);
            if (!snoozed) res.status(404);
            return new Message(snoozed ? "Snoozed for " + minutes + " minutes." : "Nothing is ringing.");
        }));

        // alarms that came due while the app was closed; the frontend shows them, then clears them
        get("/api/alarms/missed", Routes.json("GET /api/alarms/missed", (req, res) -> dateAlarm.getMissedAlarms()));

        delete("/api/alarms/missed", Routes.json("DELETE /api/alarms/missed", (req, res) -> {
            dateAlarm.clearMissedAlarms();
            return new Message("Missed alarms cleared.");
        }));

        // optional ?from=YYYY-MM-DD&to=YYYY-MM-DD
        get("/api/alarms", Routes.json("GET /api/alarms", (req, res) -> {
            try {
                LocalDate from = parseDate(req.queryParams("from"));
                LocalDate to = parseDate(req.queryParams("to"));
                if (from == null && to == null) return dateAlarm.getAlarms();
                if (from != null && to != null && to.isBefore(from)) throw new BadRequest("'to' is before 'from'.");
                return Database.get().loadRange(from, to);
            } catch (DateTimeParseException e) {
                throw new BadRequest("Dates must look like YYYY-MM-DD.");
            }
        }));

        post("/api/alarms", Routes.json("POST /api/alarms", (req, res) -> {
            AlarmRequest body = read(req);
            AlarmRecord created = dateAlarm.setAlarm(LocalDateTime.parse(body.time), body.title, body.desc, storedImage(body.imageSource));
            return new Created("Alarm set!", created.id());
        }));

        delete("/api/alarms", Routes.json("DELETE /api/alarms", (req, res) -> {
            AlarmRequest body = read(req);
            boolean removed = body.id != null
                ? dateAlarm.removeAlarm(body.id.longValue())
                : dateAlarm.removeAlarm(LocalDateTime.parse(body.time));
            return removedMessage(res, removed);
        }));

        delete("/api/alarms/:id", Routes.json("DELETE /api/alarms/:id", (req, res) ->
            removedMessage(res, dateAlarm.removeAlarm(req.params(":id")))));

        put("/api/alarms/:id", Routes.json("PUT /api/alarms/:id", (req, res) -> {
            AlarmRequest body = read(req);
            // no image fields keeps the current picture, clearImage removes it
            String image = Boolean.TRUE.equals(body.clearImage) ? ""
                : body.imageSource == null ? null
                : storedImage(body.imageSource);
            boolean updated = dateAlarm.updateAlarm(req.params(":id"), LocalDateTime.parse(body.time), body.title, body.desc, image);
            if (!updated) res.status(404);
            return new Message(updated ? "Alarm updated..." : "Alarm not found.");
        }));
    }
}
