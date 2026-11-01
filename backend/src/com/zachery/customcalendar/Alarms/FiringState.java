package com.zachery.customcalendar.Alarms;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/* Which alarm is ringing right now, if any. The frontend polls this to show its popup. */
public final class FiringState {

    private FiringState() {}

    public record Snapshot(boolean firing, String title, String desc) {}

    private static final AtomicBoolean firing = new AtomicBoolean(false);
    private static final AtomicReference<String> title = new AtomicReference<>("");
    private static final AtomicReference<String> desc = new AtomicReference<>("");

    public static void start(String alarmTitle, String alarmDesc) {
        title.set(alarmTitle);
        desc.set(alarmDesc);
        firing.set(true);
    }

    public static void clear() {
        firing.set(false);
        title.set("");
        desc.set("");
    }

    public static Snapshot snapshot() {
        return new Snapshot(firing.get(), title.get(), desc.get());
    }
}
