package com.zachery.customcalendar;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;
import java.util.logging.Level;
import java.util.logging.Logger;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

public class Database
{
    private static final Logger LOGGER = Logger.getLogger(Database.class.getName());

    /** Table names for the two file-backed media lists. Only these two are ever accepted. */
    public static final String SOUNDS = "sounds";
    public static final String BACKGROUNDS = "backgrounds";

    /** One row of the sounds or backgrounds table. path is relative to the Calisigh folder when it lives inside it. */
    public record MediaRow(String name, String path) {}

    private static Database instance;

    /** Shared instance, so the alarm code and the holiday cache use one connection. */
    public static synchronized Database get() throws SQLException
    {
        if (instance == null) instance = new Database();
        return instance;
    }

    private final Connection conn;

    public Database() throws SQLException
    {
        File dbFile = SystemDirectory.Directory("Database/Calisigh.db");
        dbFile.getParentFile().mkdirs();

        try { Class.forName("org.sqlite.JDBC"); }
        catch (ClassNotFoundException e) { throw new SQLException("sqlite-jdbc driver not on classpath", e); }

        conn = DriverManager.getConnection("jdbc:sqlite:" + dbFile.getAbsolutePath());

        try (Statement st = conn.createStatement())
        {
            st.execute("CREATE TABLE IF NOT EXISTS alarms ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                + "time TEXT NOT NULL, "
                + "title TEXT NOT NULL, "
                + "description TEXT NOT NULL DEFAULT '')");
            st.execute("CREATE INDEX IF NOT EXISTS idx_alarms_time ON alarms(time)");
            st.execute("CREATE TABLE IF NOT EXISTS holiday_cache ("
                + "source TEXT NOT NULL, "
                + "year INTEGER NOT NULL, "
                + "payload TEXT NOT NULL, "
                + "fetched_at TEXT NOT NULL, "
                + "PRIMARY KEY (source, year))");
            st.execute("CREATE TABLE IF NOT EXISTS sounds ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                + "name TEXT NOT NULL UNIQUE, "
                + "path TEXT NOT NULL)");
            st.execute("CREATE TABLE IF NOT EXISTS backgrounds ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                + "name TEXT NOT NULL UNIQUE, "
                + "path TEXT NOT NULL)");
            st.execute("CREATE TABLE IF NOT EXISTS settings ("
                + "key TEXT PRIMARY KEY, "
                + "value TEXT NOT NULL)");
        }

        migrateLegacyEvents();
        migrateLegacySounds();
        migrateLegacyBackgrounds();
        migrateLegacySettings();
    }

    public synchronized AlarmRecord insert(LocalDateTime time, String title, String desc) throws SQLException
    {
        try (PreparedStatement ps = conn.prepareStatement(
            "INSERT INTO alarms(time, title, description) VALUES(?,?,?)"))
        {
            ps.setString(1, time.toString());
            ps.setString(2, title);
            ps.setString(3, desc == null ? "" : desc);
            ps.executeUpdate();
        }

        //getGeneratedKeys() isn't reliable across sqlite-jdbc versions; this method is
        //synchronized and there's one connection, so last_insert_rowid() is safe here
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT last_insert_rowid()"))
        {
            rs.next();
            return new AlarmRecord(rs.getLong(1), time, title, desc == null ? "" : desc);
        }
    }

    public synchronized boolean delete(long id) throws SQLException
    {
        try (PreparedStatement ps = conn.prepareStatement("DELETE FROM alarms WHERE id = ?"))
        {
            ps.setLong(1, id);
            return ps.executeUpdate() > 0;
        }
    }

    public synchronized boolean update(long id, LocalDateTime time, String title, String desc) throws SQLException
    {
        try (PreparedStatement ps = conn.prepareStatement(
            "UPDATE alarms SET time = ?, title = ?, description = ? WHERE id = ?"))
        {
            ps.setString(1, time.toString());
            ps.setString(2, title);
            ps.setString(3, desc == null ? "" : desc);
            ps.setLong(4, id);
            return ps.executeUpdate() > 0;
        }
    }

    public synchronized String getCached(String source, int year) throws SQLException
    {
        try (PreparedStatement ps = conn.prepareStatement(
            "SELECT payload FROM holiday_cache WHERE source = ? AND year = ?"))
        {
            ps.setString(1, source);
            ps.setInt(2, year);
            try (ResultSet rs = ps.executeQuery())
            {
                return rs.next() ? rs.getString(1) : null;
            }
        }
    }

    public synchronized void putCached(String source, int year, String payload) throws SQLException
    {
        try (PreparedStatement ps = conn.prepareStatement(
            "INSERT OR REPLACE INTO holiday_cache(source, year, payload, fetched_at) VALUES(?,?,?,?)"))
        {
            ps.setString(1, source);
            ps.setInt(2, year);
            ps.setString(3, payload);
            ps.setString(4, LocalDateTime.now().toString());
            ps.executeUpdate();
        }
    }

    /* ---------- sounds / backgrounds (name + file path) ---------- */

    private static String checkTable(String table)
    {
        if (!SOUNDS.equals(table) && !BACKGROUNDS.equals(table))
            throw new IllegalArgumentException("Unknown media table: " + table);
        return table;
    }

    public synchronized List<MediaRow> listMedia(String table) throws SQLException
    {
        List<MediaRow> out = new ArrayList<>();
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT name, path FROM " + checkTable(table) + " ORDER BY id"))
        {
            while (rs.next()) out.add(new MediaRow(rs.getString(1), rs.getString(2)));
        }
        return out;
    }

    public synchronized MediaRow findMedia(String table, String name) throws SQLException
    {
        try (PreparedStatement ps = conn.prepareStatement(
            "SELECT name, path FROM " + checkTable(table) + " WHERE name = ?"))
        {
            ps.setString(1, name);
            try (ResultSet rs = ps.executeQuery())
            {
                return rs.next() ? new MediaRow(rs.getString(1), rs.getString(2)) : null;
            }
        }
    }

    /** Returns false if that name already exists (nothing is changed). */
    public synchronized boolean addMedia(String table, String name, String storedPath) throws SQLException
    {
        try (PreparedStatement ps = conn.prepareStatement(
            "INSERT OR IGNORE INTO " + checkTable(table) + "(name, path) VALUES(?,?)"))
        {
            ps.setString(1, name);
            ps.setString(2, storedPath);
            return ps.executeUpdate() > 0;
        }
    }

    public synchronized boolean removeMedia(String table, String name) throws SQLException
    {
        try (PreparedStatement ps = conn.prepareStatement(
            "DELETE FROM " + checkTable(table) + " WHERE name = ?"))
        {
            ps.setString(1, name);
            return ps.executeUpdate() > 0;
        }
    }

    /* ---------- settings (selected sound, volume) ---------- */

    public synchronized String getSetting(String key) throws SQLException
    {
        try (PreparedStatement ps = conn.prepareStatement("SELECT value FROM settings WHERE key = ?"))
        {
            ps.setString(1, key);
            try (ResultSet rs = ps.executeQuery())
            {
                return rs.next() ? rs.getString(1) : null;
            }
        }
    }

    /** A null value removes the setting. */
    public synchronized void setSetting(String key, String value) throws SQLException
    {
        if (value == null)
        {
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM settings WHERE key = ?"))
            {
                ps.setString(1, key);
                ps.executeUpdate();
            }
            return;
        }

        try (PreparedStatement ps = conn.prepareStatement(
            "INSERT OR REPLACE INTO settings(key, value) VALUES(?,?)"))
        {
            ps.setString(1, key);
            ps.setString(2, value);
            ps.executeUpdate();
        }
    }

    /* ---------- stored paths ----------
    Files live inside the Calisigh folder, so the database keeps the part after it
    ("Backgrounds/Uploads/sunset.png"). That keeps entries valid after a restore, a
    username change, or a move to another PC. A path outside the folder stays absolute.
    */

    private static String norm(String path)
    {
        String p = path.replace('\\', '/');
        while (p.length() > 1 && p.endsWith("/")) p = p.substring(0, p.length() - 1);
        return p;
    }

    public static File baseDir()
    {
        return SystemDirectory.Directory("").getAbsoluteFile();
    }

    public static String toStoredPath(File file)
    {
        String base = norm(baseDir().getPath());
        String p = norm(file.getAbsolutePath());
        boolean ignoreCase = File.separatorChar == '\\';

        if (p.length() > base.length() + 1 && p.regionMatches(ignoreCase, 0, base + "/", 0, base.length() + 1))
            return p.substring(base.length() + 1);

        return file.getAbsolutePath();
    }

    public static File fromStoredPath(String stored)
    {
        File f = new File(stored);
        return f.isAbsolute() ? f : new File(baseDir(), stored);
    }

    /* Like toStoredPath, but for old absolute paths: if the file is gone from that spot
       (new username, restored backup), look for the same relative path under the current
       Calisigh folder. */
    private static String legacyToStored(String oldPath)
    {
        String stored = toStoredPath(new File(oldPath));
        if (!new File(stored).isAbsolute()) return stored;
        if (new File(stored).exists()) return stored;

        String p = norm(oldPath);
        int idx = p.lastIndexOf("/Calisigh/");
        if (idx >= 0)
        {
            String rel = p.substring(idx + "/Calisigh/".length());
            if (!rel.isEmpty() && new File(baseDir(), rel).exists()) return rel;
        }
        return stored;
    }

    /* ---------- one-time imports of the old text/JSON files ---------- */

    //renames to <name>.migrated (never deletes), same rollback story as Events.txt
    private void retireLegacyFile(File legacy)
    {
        try
        {
            File target = new File(legacy.getParentFile(), legacy.getName() + ".migrated");
            if (target.exists())
                target = new File(legacy.getParentFile(), legacy.getName() + ".migrated." + System.currentTimeMillis());
            Files.move(legacy.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE);
        }
        catch (Exception e)
        {
            LOGGER.log(Level.SEVERE, "Imported " + legacy.getName() + " but couldn't rename it", e);
        }
    }

    private boolean importMedia(String table, List<String[]> rows)
    {
        int count = 0;
        try
        {
            conn.setAutoCommit(false);
            try (PreparedStatement ps = conn.prepareStatement(
                "INSERT OR IGNORE INTO " + checkTable(table) + "(name, path) VALUES(?,?)"))
            {
                for (String[] r : rows)
                {
                    ps.setString(1, r[0]);
                    ps.setString(2, legacyToStored(r[1]));
                    count += ps.executeUpdate();
                }
            }
            conn.commit();
        }
        catch (Exception e)
        {
            try { conn.rollback(); } catch (SQLException ignored) {}
            LOGGER.log(Level.SEVERE, "Import into " + table + " failed; leaving the old file in place", e);
            return false;
        }
        finally
        {
            try { conn.setAutoCommit(true); } catch (SQLException ignored) {}
        }

        String msg = "Migrated " + count + " rows into " + table;
        LOGGER.info(msg);
        System.out.println(msg);
        return true;
    }

    private void migrateLegacySounds()
    {
        File legacy = SystemDirectory.Directory("AlarmSounds/AlarmSounds.txt");
        if (!legacy.exists() || legacy.length() == 0) return;

        List<String[]> rows = new ArrayList<>();
        try (Scanner scan = new Scanner(legacy))
        {
            while (scan.hasNextLine())
            {
                String line = scan.nextLine().trim();
                if (line.isEmpty()) continue;

                String[] parts = line.split("\\|&", 2);
                if (parts.length < 2) { LOGGER.warning("Skipping bad legacy sound line: " + line); continue; }
                rows.add(new String[] { parts[0], parts[1] });
            }
        }
        catch (Exception e)
        {
            LOGGER.log(Level.SEVERE, "Couldn't read AlarmSounds.txt; leaving it in place", e);
            return;
        }

        if (importMedia(SOUNDS, rows)) retireLegacyFile(legacy);
    }

    private void migrateLegacyBackgrounds()
    {
        File legacy = SystemDirectory.Directory("Backgrounds/Backgrounds.json");
        if (!legacy.exists() || legacy.length() == 0) return;

        List<String[]> rows = new ArrayList<>();
        try
        {
            String json = new String(Files.readAllBytes(legacy.toPath()), StandardCharsets.UTF_8);
            for (JsonElement el : JsonParser.parseString(json).getAsJsonArray())
            {
                JsonObject obj = el.getAsJsonObject();
                rows.add(new String[] { obj.get("name").getAsString(), obj.get("path").getAsString() });
            }
        }
        catch (Exception e)
        {
            LOGGER.log(Level.SEVERE, "Couldn't read Backgrounds.json; leaving it in place", e);
            return;
        }

        if (importMedia(BACKGROUNDS, rows)) retireLegacyFile(legacy);
    }

    private void migrateLegacySettings()
    {
        migrateSettingFile(SystemDirectory.Directory("AlarmSounds/SelectedSound.txt"), "selectedSound");
        migrateSettingFile(SystemDirectory.Directory("AlarmSounds/Volume.txt"), "volume");
    }

    private void migrateSettingFile(File legacy, String key)
    {
        if (!legacy.exists()) return;

        try
        {
            String first = "";
            try (Scanner scan = new Scanner(legacy))
            {
                if (scan.hasNextLine()) first = scan.nextLine().trim();
            }
            if (!first.isEmpty()) setSetting(key, first);
            retireLegacyFile(legacy);
        }
        catch (Exception e)
        {
            LOGGER.log(Level.SEVERE, "Couldn't import " + legacy.getName() + "; leaving it in place", e);
        }
    }

    public synchronized List<AlarmRecord> loadAll() throws SQLException
    {
        List<AlarmRecord> out = new ArrayList<>();
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT id, time, title, description FROM alarms ORDER BY id"))
        {
            while (rs.next())
                out.add(new AlarmRecord(rs.getLong(1), LocalDateTime.parse(rs.getString(2)),
                                        rs.getString(3), rs.getString(4)));
        }
        return out;
    }

    /*
    One-time import of the old Events.txt. The file is renamed to Events.txt.migrated
    afterwards (never deleted), so this only ever runs once.
    */
    private void migrateLegacyEvents()
    {
        File legacy = SystemDirectory.Directory("Events/Events.txt");
        if (!legacy.exists()) return;

        int count = 0;
        try
        {
            conn.setAutoCommit(false);
            try (Scanner scan = new Scanner(legacy);
                 PreparedStatement ps = conn.prepareStatement(
                     "INSERT INTO alarms(time, title, description) VALUES(?,?,?)"))
            {
                while (scan.hasNextLine())
                {
                    String line = scan.nextLine().trim();
                    if (line.isEmpty()) continue;

                    String[] parts = line.split("\\|&\\^");
                    if (parts.length < 2) continue;

                    LocalDateTime time;
                    try { time = LocalDateTime.parse(parts[0]); }
                    catch (Exception e) { LOGGER.warning("Skipping bad legacy line: " + line); continue; }

                    ps.setString(1, time.toString());
                    ps.setString(2, parts[1].replace("<NL>", "\n"));
                    ps.setString(3, (parts.length > 2 ? parts[2] : "").replace("<aNL>", "\n"));
                    ps.executeUpdate();
                    count++;
                }
            }
            conn.commit();
        }
        catch (Exception e)
        {
            try { conn.rollback(); } catch (SQLException ignored) {}
            LOGGER.log(Level.SEVERE, "Events.txt migration failed; leaving file in place", e);
            return;
        }
        finally
        {
            try { conn.setAutoCommit(true); } catch (SQLException ignored) {}
        }

        try
        {
            File target = new File(legacy.getParentFile(), "Events.txt.migrated");
            if (target.exists())
                target = new File(legacy.getParentFile(), "Events.txt.migrated." + System.currentTimeMillis());
            Files.move(legacy.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE);
        }
        catch (Exception e)
        {
            LOGGER.log(Level.SEVERE, "Imported alarms but couldn't rename Events.txt", e);
        }

        String msg = "Migrated " + count + " alarms from Events.txt to SQLite";
        LOGGER.info(msg);
        System.out.println(msg);
    }
}
