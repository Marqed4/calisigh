package com.zachery.customcalendar.Media;

import com.zachery.customcalendar.Alarms.FiringState;
import com.zachery.customcalendar.Http.Json;
import com.zachery.customcalendar.Http.Json.Message;
import com.zachery.customcalendar.Http.Routes;

import static spark.Spark.delete;
import static spark.Spark.get;
import static spark.Spark.post;

/* Alarm sounds and background pictures */
public class MediaRoutes {

    private final AlarmSounds sounds;
    private final Backgrounds backgrounds;

    public MediaRoutes(AlarmSounds sounds, Backgrounds backgrounds) {
        this.sounds = sounds;
        this.backgrounds = backgrounds;
    }

    static class MediaRequest {
        String sourcePath, name;
    }

    static class VolumeRequest {
        float volume;
    }

    static class Volume {
        final float volume;
        Volume(float volume) { this.volume = volume; }
    }

    private static MediaRequest read(spark.Request req) {
        return Json.GSON.fromJson(req.body(), MediaRequest.class);
    }

    public void register() {
        registerBackgrounds();
        registerSounds();
    }

    private void registerBackgrounds() {
        get("/api/backgrounds", Routes.json("GET /api/backgrounds", (req, res) -> backgrounds.getAllBackgrounds()));

        post("/api/backgrounds", Routes.json("POST /api/backgrounds", (req, res) -> {
            backgrounds.addBackground(read(req).sourcePath);
            return new Message("Background added!");
        }));

        delete("/api/backgrounds", Routes.json("DELETE /api/backgrounds", (req, res) -> {
            backgrounds.removeBackground(read(req).name);
            return new Message("Background removed!");
        }));
    }

    private void registerSounds() {
        get("/api/sounds", Routes.json("GET /api/sounds", (req, res) -> sounds.getAllSounds()));
        get("/api/sounds/selected", Routes.json("GET /api/sounds/selected", (req, res) -> sounds.getSelectedSound()));
        get("/api/sounds/volume", Routes.json("GET /api/sounds/volume", (req, res) -> new Volume(sounds.getVolume())));

        post("/api/sounds/volume", Routes.json("POST /api/sounds/volume", (req, res) -> {
            sounds.setVolume(Json.GSON.fromJson(req.body(), VolumeRequest.class).volume);
            return new Message("Volume set.");
        }));

        post("/api/sounds/play", Routes.json("POST /api/sounds/play", (req, res) -> {
            String name = read(req).name;
            sounds.playSound(name);
            return new Message("Playing: " + name);
        }));

        // stopping the sound also dismisses a ringing alarm
        post("/api/sounds/stop", Routes.json("POST /api/sounds/stop", (req, res) -> {
            sounds.stopSound();
            FiringState.clear();
            return new Message("Sound stopped.");
        }));

        post("/api/sounds/select", Routes.json("POST /api/sounds/select", (req, res) -> {
            String name = read(req).name;
            sounds.selectSound(name);
            return new Message("Sound selected: " + name);
        }));

        post("/api/sounds", Routes.json("POST /api/sounds", (req, res) -> {
            sounds.addSound(read(req).sourcePath);
            return new Message("Sound added!");
        }));

        delete("/api/sounds", Routes.json("DELETE /api/sounds", (req, res) -> {
            sounds.removeSound(read(req).name);
            return new Message("Sound removed!");
        }));
    }
}
