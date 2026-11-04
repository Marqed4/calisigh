package com.zachery.customcalendar;

import com.zachery.customcalendar.Alarms.AlarmRoutes;
import com.zachery.customcalendar.Alarms.DateAlarm;
import com.zachery.customcalendar.Alarms.DescImages;
import com.zachery.customcalendar.Alarms.EventMarks;
import com.zachery.customcalendar.Alarms.Toasts;
import com.zachery.customcalendar.Assistant.Chat;
import com.zachery.customcalendar.Assistant.ChatHistory;
import com.zachery.customcalendar.Assistant.Models;
import com.zachery.customcalendar.Holidays.HolidayRoutes;
import com.zachery.customcalendar.Media.AlarmSounds;
import com.zachery.customcalendar.Media.Backgrounds;
import com.zachery.customcalendar.Media.MediaRoutes;
import com.zachery.customcalendar.Storage.SystemDirectory;

import static spark.Spark.before;
import static spark.Spark.options;
import static spark.Spark.port;

/* Starts the backend: builds the services and hands each one its routes */
public class Main
{
    public static void main(String[] args) throws Exception
    {
        // Register for toasts and seed the default sound before Spark boots, so the first alarm doesn't set that up on the fly
        String iconPath = SystemDirectory.Directory("resources/assets/images/icon.ico").getAbsolutePath();
        Toasts.register("com.zachery.calisigh", "Calisigh", iconPath);
        SystemDirectory.seedDefaultSounds();

        System.out.println("Starting...");
        System.out.flush();

        port(4567);

        // These can throw on construction (missing dirs, bad config), so crash loudly instead of running half-built
        AlarmSounds alarmSounds = new AlarmSounds();
        DateAlarm dateAlarm = new DateAlarm(alarmSounds);
        Backgrounds backgrounds = new Backgrounds();

        // Let the Tauri webview call this from its own origin
        before((req, res) -> {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
            res.header("Access-Control-Allow-Headers", "Content-Type");
        });

        options("/*", (req, res) -> {
            res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
            return "OK";
        });

        new AlarmRoutes(dateAlarm).register();
        new EventMarks().register();
        new DescImages().register();
        new MediaRoutes(alarmSounds, backgrounds).register();
        new HolidayRoutes().register();
        new Chat().register();
        new ChatHistory().register();
        new Models().register();

        // Start watching for alarms that are due
        dateAlarm.checkAlarm();

        System.out.println("Java backend running on http://localhost:4567");
        System.out.flush();
    }
}