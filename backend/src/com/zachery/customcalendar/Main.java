package com.zachery.customcalendar;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.logging.Level;
import java.util.logging.Logger;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.zachery.customcalendar.Holidays.Holiday;

import static spark.Spark.before;
import static spark.Spark.delete;
import static spark.Spark.get;
import static spark.Spark.options;
import static spark.Spark.port;
import static spark.Spark.post;
import static spark.Spark.put;

public class Main
{
    public static final AtomicBoolean alarmFiring = new AtomicBoolean(false);
    public static final AtomicReference<String> firingTitle = new AtomicReference<>("");
    public static final AtomicReference<String> firingDesc  = new AtomicReference<>("");

    //printStackTrace() goes to stderr, and release builds pipe the backend's stderr to null,
    //so it was writing to nowhere in production. routing through this instead.
    private static final Logger LOGGER = Logger.getLogger(Main.class.getName());

    public static void main(String[] args) throws Exception
    {
        /*
        Register for toasts + seed default sounds before Spark even boots,
        so the first alarm that fires doesn't have to set any of that up on the fly
        */
        String iconPath = SystemDirectory.Directory("resources/assets/images/icon.ico").getAbsolutePath();
        registerAppForToasts("com.zachery.calisigh", "Calisigh", iconPath);
        SystemDirectory.seedDefaultSounds();

        System.out.println("Starting...");
        System.out.flush();

        port(4567);

        //LocalDateTime doesn't have a default Gson serializer, roll our own
        Gson gson = new GsonBuilder()
            .registerTypeAdapter(LocalDateTime.class,
                (com.google.gson.JsonSerializer<LocalDateTime>) (src, type, ctx) ->
                    new com.google.gson.JsonPrimitive(src.toString()))
            .create();

        /*
        AlarmSounds -> DateAlarm -> Backgrounds
        each one can throw on construction (missing dirs, bad config, etc), so
        bail loud and crash instead of limping along with a half-built backend
        */
        AlarmSounds alarmSounds;
        try {
            alarmSounds = new AlarmSounds();
        } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
            LOGGER.log(Level.SEVERE, "Failed to init AlarmSounds", e);
            throw e;
        }

        DateAlarm dateAlarm;
        try {
            dateAlarm = new DateAlarm(alarmSounds);
        } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
            LOGGER.log(Level.SEVERE, "Failed to init DateAlarm", e);
            throw e;
        }

        Backgrounds backgrounds;
        try {
            backgrounds = new Backgrounds();
        } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
            LOGGER.log(Level.SEVERE, "Failed to init Backgrounds", e);
            throw e;
        }

        //Let the Tauri webview hit this from its own origin
        before((req, res) -> {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
            res.header("Access-Control-Allow-Headers", "Content-Type");
        });

        //Preflight catch-all so the browser stops complaining
        options("/*", (req, res) -> {
            res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
            return "OK";
        });

        // Alarm firing state endpoints
        get("/api/alarms/firing", (req, res) -> {
            res.type("application/json");
            return gson.toJson(new FiringResponse(
                alarmFiring.get(),
                firingTitle.get(),
                firingDesc.get()
            ));
        });

        delete("/api/alarms/firing", (req, res) -> {
            res.type("application/json");
            alarmFiring.set(false);
            firingTitle.set("");
            firingDesc.set("");
            return gson.toJson(new MessageResponse("Firing cleared."));
        });

        // Alarm CRUD
        get("/api/alarms", (req, res) -> {
            res.type("application/json");
            try {
                return gson.toJson(dateAlarm.getAlarms());
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "GET /api/alarms failed", e);
                res.status(500);
                return "{\"error\": \"" + e.getMessage() + "\"}";
            }
        });

        post("/api/alarms", (req, res) -> {
            res.type("application/json");
            try {
                AlarmRequest body = gson.fromJson(req.body(), AlarmRequest.class);
                dateAlarm.setAlarm(
                    LocalDateTime.parse(body.time),
                    body.title,
                    body.desc
                );
                return gson.toJson(new MessageResponse("Alarm set!"));
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "POST /api/alarms failed", e);
                res.status(500);
                return gson.toJson(new MessageResponse("Failed: " + e.getMessage()));
            }
        });

        delete("/api/alarms", (req, res) -> {
            res.type("application/json");
            try {
                AlarmRequest body = gson.fromJson(req.body(), AlarmRequest.class);
                boolean removed = (body.id != null)
                    ? dateAlarm.removeAlarm(body.id.longValue())
                    : dateAlarm.removeAlarm(LocalDateTime.parse(body.time));
                if (!removed) res.status(404);
                return gson.toJson(new MessageResponse(removed ? "Alarm removed!" : "Alarm not found."));
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "DELETE /api/alarms failed", e);
                res.status(500);
                return gson.toJson(new MessageResponse("Failed: " + e.getMessage()));
            }
        });

        delete("/api/alarms/:id", (req, res) -> {
            res.type("application/json");
            try {
                boolean removed = dateAlarm.removeAlarm(req.params(":id"));
                if (!removed) res.status(404);
                return gson.toJson(new MessageResponse(removed ? "Alarm removed!" : "Alarm not found."));
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "DELETE /api/alarms/:id failed", e);
                res.status(500);
                return gson.toJson(new MessageResponse("Failed: " + e.getMessage()));
            }
        });

        put("/api/alarms/:id", (req, res) -> {
            res.type("application/json");
            try {
                String id = req.params(":id");
                AlarmRequest body = gson.fromJson(req.body(), AlarmRequest.class);
                boolean updated = dateAlarm.updateAlarm(
                    id,
                    LocalDateTime.parse(body.time),
                    body.title,
                    body.desc
                );
                if (!updated) res.status(404);
                return gson.toJson(new MessageResponse(updated ? "Alarm updated..." : "Alarm not found."));
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "PUT /api/alarms/:id failed", e);
                res.status(500);
                return gson.toJson(new MessageResponse("Failed: " + e.getMessage()));
            }
        });

        // Background image endpoints
        get("/api/backgrounds", (req, res) -> {
            res.type("application/json");
            try {
                return gson.toJson(backgrounds.getAllBackgrounds());
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "GET /api/backgrounds failed", e);
                res.status(500);
                return "{\"error\": \"" + e.getMessage() + "\"}";
            }
        });

        post("/api/backgrounds", (req, res) -> {
            res.type("application/json");
            try {
                BackgroundRequest body = gson.fromJson(req.body(), BackgroundRequest.class);
                backgrounds.addBackground(body.sourcePath);
                return gson.toJson(new MessageResponse("Background added!"));
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "POST /api/backgrounds failed", e);
                res.status(500);
                return gson.toJson(new MessageResponse("Failed: " + e.getMessage()));
            }
        });

        delete("/api/backgrounds", (req, res) -> {
            res.type("application/json");
            try {
                BackgroundRequest body = gson.fromJson(req.body(), BackgroundRequest.class);
                backgrounds.removeBackground(body.name);
                return gson.toJson(new MessageResponse("Background removed!"));
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "DELETE /api/backgrounds failed", e);
                res.status(500);
                return gson.toJson(new MessageResponse("Failed: " + e.getMessage()));
            }
        });

        // Alarm sound endpoints
        get("/api/sounds", (req, res) -> {
            res.type("application/json");
            try {
                return gson.toJson(alarmSounds.getAllSounds());
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "GET /api/sounds failed", e);
                res.status(500);
                return "{\"error\": \"" + e.getMessage() + "\"}";
            }
        });

        get("/api/sounds/selected", (req, res) -> {
            res.type("application/json");
            try {
                return gson.toJson(alarmSounds.getSelectedSound());
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "GET /api/sounds/selected failed", e);
                res.status(500);
                return "null";
            }
        });

        get("/api/sounds/volume", (req, res) -> {
            res.type("application/json");
            try {
                return gson.toJson(new VolumeResponse(alarmSounds.getVolume()));
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "GET /api/sounds/volume failed", e);
                res.status(500);
                return "{\"error\": \"" + e.getMessage() + "\"}";
            }
        });

        post("/api/sounds/volume", (req, res) -> {
            res.type("application/json");
            try {
                VolumeRequest body = gson.fromJson(req.body(), VolumeRequest.class);
                alarmSounds.setVolume(body.volume);
                return gson.toJson(new MessageResponse("Volume set."));
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "POST /api/sounds/volume failed", e);
                res.status(500);
                return gson.toJson(new MessageResponse("Failed: " + e.getMessage()));
            }
        });

        post("/api/sounds/play", (req, res) -> {
            res.type("application/json");
            try {
                SoundRequest body = gson.fromJson(req.body(), SoundRequest.class);
                alarmSounds.playSound(body.name);
                return gson.toJson(new MessageResponse("Playing: " + body.name));
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "POST /api/sounds/play failed", e);
                res.status(500);
                return gson.toJson(new MessageResponse("Failed: " + e.getMessage()));
            }
        });

        post("/api/sounds/stop", (req, res) -> {
            res.type("application/json");
            try {
                alarmSounds.stopSound();
                alarmFiring.set(false);
                firingTitle.set("");
                firingDesc.set("");
                return gson.toJson(new MessageResponse("Sound stopped."));
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "POST /api/sounds/stop failed", e);
                res.status(500);
                return gson.toJson(new MessageResponse("Failed: " + e.getMessage()));
            }
        });

        post("/api/sounds/select", (req, res) -> {
            res.type("application/json");
            try {
                SoundRequest body = gson.fromJson(req.body(), SoundRequest.class);
                alarmSounds.selectSound(body.name);
                return gson.toJson(new MessageResponse("Sound selected: " + body.name));
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "POST /api/sounds/select failed", e);
                res.status(500);
                return gson.toJson(new MessageResponse("Failed: " + e.getMessage()));
            }
        });

        post("/api/sounds", (req, res) -> {
            res.type("application/json");
            try {
                SoundRequest body = gson.fromJson(req.body(), SoundRequest.class);
                alarmSounds.addSound(body.sourcePath);
                return gson.toJson(new MessageResponse("Sound added!"));
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "POST /api/sounds failed", e);
                res.status(500);
                return gson.toJson(new MessageResponse("Failed: " + e.getMessage()));
            }
        });

        delete("/api/sounds", (req, res) -> {
            res.type("application/json");
            try {
                SoundRequest body = gson.fromJson(req.body(), SoundRequest.class);
                alarmSounds.removeSound(body.name);
                return gson.toJson(new MessageResponse("Sound removed!"));
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "DELETE /api/sounds failed", e);
                res.status(500);
                return gson.toJson(new MessageResponse("Failed: " + e.getMessage()));
            }
        });

        // Holidays/observances, filterable by year + category
        get("/api/holidays", (req, res) -> {
            res.type("application/json");
            try {
                String yearParam = req.queryParams("year");
                int year = (yearParam != null)
                    ? Integer.parseInt(yearParam)
                    : java.time.LocalDate.now().getYear();

                // Optional comma-separated category filter, e.g. ?categories=federal,religious
                String catParam = req.queryParams("categories");
                java.util.List<Holiday> all = HolidaysMaster.forYear(year);

                if (catParam != null && !catParam.isBlank()) {
                    java.util.Set<String> wanted = new java.util.HashSet<>(
                        java.util.Arrays.asList(catParam.split(","))
                    );
                    all = all.stream()
                        .filter(h -> wanted.contains(h.category))
                        .collect(java.util.stream.Collectors.toList());
                }

                return gson.toJson(all);
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, "GET /api/holidays failed", e);
                res.status(500);
                return "{\"error\": \"" + e.getMessage() + "\"}"; 
            }
        });

        //Kick off the alarm-firing watch loop
        dateAlarm.checkAlarm();

        //Wire up the AI chat routes
        new Chat().register();

        System.out.println("Java backend running on http://localhost:4567");
        System.out.flush();
    }

    static class AlarmRequest
    {
        Long id;
        String time, title, desc;
    }

    static class BackgroundRequest
    {
        String sourcePath, name;
    }

    static class SoundRequest
    {
        String sourcePath, name;
    }

    static class VolumeRequest
    {
        float volume;
    }

    static class VolumeResponse
    {
        float volume;
        VolumeResponse(float v) { this.volume = v; }
    }

    static class MessageResponse
    {
        String message;
        MessageResponse(String msg) { this.message = msg; }
    }

    static class FiringResponse
    {
        boolean firing;
        String title;
        String desc;
        FiringResponse(boolean firing, String title, String desc)
        {
            this.firing = firing;
            this.title  = title;
            this.desc   = desc;
        }
    }

    /*
    Windows won't show a toast with our name/icon unless the app has an
    AppUserModelID registered under HKCU first, so write it ourselves here
    instead of making the installer do it
    */
    private static void registerAppForToasts(String aumid, String displayName, String iconPath)
    {
        try
        {
            String regPath = "HKCU\\Software\\Classes\\AppUserModelId\\" + aumid;

            Runtime.getRuntime().exec(new String[]{
                "reg", "add", regPath,
                "/v", "DisplayName", "/t", "REG_SZ", "/d", displayName, "/f"
            }).waitFor();

            Runtime.getRuntime().exec(new String[]{
                "reg", "add", regPath,
                "/v", "IconUri", "/t", "REG_SZ", "/d", iconPath, "/f"
            }).waitFor();

            System.out.println("App registered for toasts: " + aumid);
        }
        //exec().waitFor() only throws these two, no need for a broad Exception catch
        catch (IOException | InterruptedException e)
        {
            System.err.println("couldn't register the app. windows just doesn't get me. " + e.getMessage());
        }
    }
}
