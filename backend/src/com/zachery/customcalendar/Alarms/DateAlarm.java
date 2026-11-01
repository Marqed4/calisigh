package com.zachery.customcalendar.Alarms;

import com.zachery.customcalendar.Media.AlarmSounds;
import com.zachery.customcalendar.Storage.Database;

import java.sql.SQLException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.PriorityQueue;

public class DateAlarm
{
    private final PriorityQueue<AlarmRecord> alarmDataQueue = new PriorityQueue<>();
    private final List<AlarmRecord> alarmDataList = new ArrayList<>();
    private final Object lock = new Object();

    //how long the scheduler sleeps between wall-clock checks
    private static final long MAX_SLEEP_SLICE_MS = 1000;

    private final Database db;
    private final AlarmSounds alarmSounds;
    private Thread alarmThread = null;

    public DateAlarm(AlarmSounds alarmSounds) throws Exception
    {
        this.alarmSounds = alarmSounds;
        this.db = Database.get();

        synchronized (lock)
        {
            for (AlarmRecord alarm : db.loadAll())
            {
                alarmDataList.add(alarm);

                //only future alarms get scheduled at startup
                if (alarm.time().isAfter(LocalDateTime.now()))
                    alarmDataQueue.add(alarm);
            }
        }
        checkAlarm();
    }

    public List<AlarmRecord> getAlarms()
    {
        synchronized (lock) { return new ArrayList<>(alarmDataList); }
    }

    public void setAlarm(LocalDateTime time, String title, String desc, String image) throws SQLException
    {
        AlarmRecord alarm = db.insert(time, title, desc, image);

        synchronized (lock)
        {
            alarmDataQueue.add(alarm);
            alarmDataList.add(alarm);
        }
        checkAlarm();
    }

    /** Exact delete by id. */
    public boolean removeAlarm(long id) throws SQLException
    {
        boolean removed = db.delete(id);
        synchronized (lock)
        {
            alarmDataQueue.removeIf(a -> a.id() == id);
            alarmDataList.removeIf(a -> a.id() == id);
        }
        checkAlarm();
        return removed;
    }

    /** Legacy delete by time: removes only the first alarm at that time. */
    public boolean removeAlarm(LocalDateTime time) throws SQLException
    {
        Long id = findIdByTime(time);
        return id != null && removeAlarm(id);
    }

    /** Accepts a numeric id or an old-style time string. */
    public boolean removeAlarm(String idOrTime) throws SQLException
    {
        Long id = resolveId(idOrTime);
        return id != null && removeAlarm(id);
    }

    // newImage is the stored (relative) path, "" to clear, or null to keep the current picture
    public boolean updateAlarm(String idOrTime, LocalDateTime newTime, String newTitle, String newDesc, String newImage) throws SQLException
    {
        Long id = resolveId(idOrTime);
        if (id == null) return false;

        String image = newImage;
        if (image == null)
        {
            String current = getAlarms().stream().filter(a -> a.id() == id).map(AlarmRecord::image).findFirst().orElse("");
            image = current.isEmpty() ? "" : Database.toStoredPath(new java.io.File(current));
        }
        if (!db.update(id, newTime, newTitle, newDesc, image))
            return false;

        AlarmRecord updated = new AlarmRecord(id, newTime, newTitle, newDesc == null ? "" : newDesc, Database.imageToApi(image));

        synchronized (lock)
        {
            alarmDataQueue.removeIf(a -> a.id() == id);
            alarmDataQueue.add(updated);

            for (int i = 0; i < alarmDataList.size(); i++)
                if (alarmDataList.get(i).id() == id) { alarmDataList.set(i, updated); break; }
        }
        checkAlarm();
        return true;
    }

    private Long resolveId(String idOrTime)
    {
        try { return Long.parseLong(idOrTime); }
        catch (NumberFormatException e) { return findIdByTime(LocalDateTime.parse(idOrTime)); }
    }

    private Long findIdByTime(LocalDateTime time)
    {
        synchronized (lock)
        {
            for (AlarmRecord a : alarmDataList)
                if (a.time().equals(time)) return a.id();
        }
        return null;
    }

    public void checkAlarm()
    {
        if (alarmThread != null && alarmThread.isAlive())
        {
            alarmThread.interrupt();
            try {
                alarmThread.join(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }

        alarmThread = new Thread(() ->
        {
            while (!Thread.currentThread().isInterrupted())
            {
                AlarmRecord nextAlarm;
                synchronized (lock) { nextAlarm = alarmDataQueue.peek(); }
                if (nextAlarm == null) break;

                /*
                Never do one long sleep for the whole wait. Thread.sleep() doesn't count time the
                PC spends asleep/hibernating, so a single sleep(delayMs) wakes up late by however
                long the machine was suspended. Sleep in short slices and re-check the wall clock
                every time instead; the head of the queue is also re-read each slice, so edits and
                earlier alarms are picked up without relying on the interrupt alone.
                */
                long delayMs = Duration.between(LocalDateTime.now(), nextAlarm.time()).toMillis();
                if (delayMs > 0)
                {
                    try { Thread.sleep(Math.min(delayMs, MAX_SLEEP_SLICE_MS)); }
                    catch (InterruptedException e)
                    {
                        Thread.currentThread().interrupt();
                        return;
                    }
                    continue;
                }

                AlarmRecord cannon;
                synchronized (lock)
                {
                    //edited/deleted/preempted while we slept? re-evaluate instead of firing
                    if (alarmDataQueue.peek() != nextAlarm) continue;
                    cannon = alarmDataQueue.poll();
                }
                if (cannon == null) continue;

                long lateMs = Duration.between(cannon.time(), LocalDateTime.now()).toMillis();
                System.out.println("=== ALARM FIRING: " + cannon.title() + " (late by " + lateMs + "ms)");

                try
                {
                    String selected = alarmSounds.getSelectedSound();
                    AlarmActivation activation = new AlarmActivation(cannon.title(), cannon.desc());

                    FiringState.start(cannon.title(), cannon.desc());

                    //a failed toast shouldn't also silence the sound
                    try { activation.displayTray(); }
                    catch (Exception e)
                    {
                        System.err.println("toast failed, playing the sound anyway. " + e.getMessage());
                    }

                    String soundName = (selected != null && !selected.isEmpty()) ? selected : "chime";
                    alarmSounds.playSound(soundName);
                }
                catch (Exception e)
                {
                    System.err.println("alarm didn't fire. great, just great. " + e.getMessage());
                    e.printStackTrace();
                }
            }
        });

        alarmThread.setDaemon(true);
        alarmThread.start();
    }
}
