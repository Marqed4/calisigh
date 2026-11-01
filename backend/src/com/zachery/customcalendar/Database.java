package com.zachery.customcalendar;

import java.io.File;
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

public class Database
{
    private static final Logger LOGGER = Logger.getLogger(Database.class.getName());

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
        }

        migrateLegacyEvents();
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
