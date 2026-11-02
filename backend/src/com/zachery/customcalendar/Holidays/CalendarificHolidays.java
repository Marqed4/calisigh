package com.zachery.customcalendar.Holidays;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.SQLException;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;
import java.util.logging.Logger;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.zachery.customcalendar.Storage.Database;
import com.zachery.customcalendar.Storage.SystemDirectory;

/*
Every holiday in the app comes from Calendarific now.

- One API call per (country, year), then the mapped result is cached in SQLite
  (holiday_cache) and never fetched again. Offline, only already-cached years show up.
- The API key lives in config.properties in the Calisigh app-data folder, NOT in the repo.
  The env var CALENDARIFIC_API_KEY overrides the file if it is set.
- Calendarific's "type" values are mapped onto the four categories the frontend already knows
  (federal / observance / religious / astronomical), so /api/holidays keeps the same shape.
*/
public final class CalendarificHolidays
{
    private static final Logger LOGGER = Logger.getLogger(CalendarificHolidays.class.getName());

    private static final String API_URL = "https://calendarific.com/api/v2/holidays";
    private static final String PLACEHOLDER_KEY = "YOUR_KEY_HERE";
    private static final String DEFAULT_COUNTRY = "US";
    private static final long RETRY_COOLDOWN_MS = 10 * 60 * 1000L;
    private static final int SHORT_NAME_MAX = 16;

    private static final String CONFIG_TEMPLATE =
        "# Calisigh settings. Keep this file out of git and out of screenshots.\n"
        + "# Get a key at https://calendarific.com and paste it below.\n"
        + "calendarific.api.key=" + PLACEHOLDER_KEY + "\n"
        + "# Two letter country code (US, CA, GB, ...)\n"
        + "calendarific.country=" + DEFAULT_COUNTRY + "\n";

    //anything whose Calendarific type contains one of these counts as religious
    private static final String[] RELIGIOUS_WORDS = {
        "religious", "hebrew", "jewish", "muslim", "islam", "hindu", "christian",
        "orthodox", "buddh", "sikh", "bahai", "jain", "catholic"
    };

    private static final HttpClient HTTP = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();

    private static final Gson GSON = new Gson();
    private static final Object FETCH_LOCK = new Object();

    //after a failed call, don't retry that year for a few minutes (protects the free quota)
    private static final Map<String, Long> lastFailure = new ConcurrentHashMap<>();
    private static volatile boolean warnedNoKey = false;

    private CalendarificHolidays() {}

    public static List<Holiday> forYear(int year)
    {
        Config cfg = Config.load();
        String source = "calendarific-" + cfg.country;

        Database db = null;
        try { db = Database.get(); }
        catch (SQLException e) { LOGGER.log(Level.WARNING, "Holiday cache unavailable, going straight to the API", e); }

        List<Holiday> cached = readCache(db, source, year);
        if (cached != null) return cached;

        if (cfg.apiKey == null)
        {
            if (!warnedNoKey)
            {
                warnedNoKey = true;
                LOGGER.warning("No Calendarific API key set. Put it in "
                    + SystemDirectory.Directory("config.properties").getAbsolutePath()
                    + " (calendarific.api.key=...) and holidays will load.");
            }
            return new ArrayList<>();
        }

        String failKey = source + ":" + year;
        Long failedAt = lastFailure.get(failKey);
        if (failedAt != null && System.currentTimeMillis() - failedAt < RETRY_COOLDOWN_MS)
            return new ArrayList<>();

        synchronized (FETCH_LOCK)
        {
            //someone else may have filled the cache while we waited on the lock
            cached = readCache(db, source, year);
            if (cached != null) return cached;

            try
            {
                List<Holiday> fresh = fetch(cfg, year);

                if (db != null)
                {
                    try { db.putCached(source, year, GSON.toJson(fresh)); }
                    catch (SQLException e) { LOGGER.log(Level.WARNING, "Couldn't cache holidays for " + year, e); }
                }
                lastFailure.remove(failKey);
                return fresh;
            }
            catch (Exception e)
            {
                lastFailure.put(failKey, System.currentTimeMillis());
                LOGGER.warning("Calendarific lookup failed for " + year + ": " + e.getMessage());
                return new ArrayList<>();
            }
        }
    }

    /** True when a real key is set, in config.properties or the environment. */
    public static boolean hasKey()
    {
        return Config.load().apiKey != null;
    }

    public static String country()
    {
        return Config.load().country;
    }

    /**
     * Tries the key with one real request, and only when Calendarific accepts it writes it into
     * config.properties. The year it fetched is cached, so the holidays show up right away.
     */
    public static void saveKey(String key, String country) throws IOException, InterruptedException
    {
        String cleanKey = key == null ? "" : key.trim();
        String cleanCountry = country == null || country.isBlank()
            ? DEFAULT_COUNTRY : country.trim().toUpperCase(Locale.ROOT);
        if (cleanKey.isEmpty() || cleanKey.equals(PLACEHOLDER_KEY) || cleanKey.length() > 100)
            throw new IOException("Paste the API key from your Calendarific account.");
        if (!cleanCountry.matches("[A-Z]{2}"))
            throw new IOException("The country is a two letter code, like US or GB.");

        int year = java.time.LocalDate.now().getYear();
        List<Holiday> fresh;
        try { fresh = fetch(new Config(cleanKey, cleanCountry), year); }
        catch (IOException e) { throw new IOException("Calendarific did not accept that key. Check it and try again."); }

        try { Database.get().putCached("calendarific-" + cleanCountry, year, GSON.toJson(fresh)); }
        catch (SQLException e) { LOGGER.log(Level.WARNING, "Couldn't cache holidays for " + year, e); }

        writeConfig(cleanKey, cleanCountry);
        lastFailure.clear();
        warnedNoKey = false;
    }

    // Keeps the comments and any other lines the user added
    private static void writeConfig(String key, String country) throws IOException
    {
        File f = SystemDirectory.Directory("config.properties");
        f.getParentFile().mkdirs();
        List<String> lines = f.exists()
            ? new ArrayList<>(Files.readAllLines(f.toPath(), StandardCharsets.UTF_8))
            : new ArrayList<>(List.of(CONFIG_TEMPLATE.split("\n")));

        setLine(lines, "calendarific.api.key", key);
        setLine(lines, "calendarific.country", country);
        Files.write(f.toPath(), lines, StandardCharsets.UTF_8);
    }

    private static void setLine(List<String> lines, String name, String value)
    {
        for (int i = 0; i < lines.size(); i++)
        {
            if (lines.get(i).startsWith(name + "=")) { lines.set(i, name + "=" + value); return; }
        }
        lines.add(name + "=" + value);
    }

    private static List<Holiday> fetch(Config cfg, int year) throws IOException, InterruptedException
    {
        URI uri = URI.create(API_URL
            + "?api_key=" + enc(cfg.apiKey)
            + "&country=" + enc(cfg.country)
            + "&year=" + year);

        HttpRequest req = HttpRequest.newBuilder(uri)
            .timeout(Duration.ofSeconds(15))
            .GET()
            .build();

        HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200)
        {
            String body = resp.body() == null ? "" : resp.body();
            if (body.length() > 300) body = body.substring(0, 300);
            throw new IOException("HTTP " + resp.statusCode() + " " + body);
        }

        List<Holiday> parsed = parseResponse(resp.body());
        LOGGER.info("Calendarific " + cfg.country + " " + year + ": " + parsed.size() + " holidays");

        //an empty answer is almost certainly a plan/quota problem, so don't cache it forever
        if (parsed.isEmpty())
            throw new IOException("response had no usable holidays");

        return parsed;
    }

    /** Package-visible so it can be tested against a saved response. */
    static List<Holiday> parseResponse(String json) throws IOException
    {
        JsonObject root = JsonParser.parseString(json).getAsJsonObject();

        JsonObject response = root.has("response") && root.get("response").isJsonObject()
            ? root.getAsJsonObject("response") : null;
        if (response == null || !response.has("holidays") || !response.get("holidays").isJsonArray())
            throw new IOException("unexpected response shape");

        List<Holiday> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int total = 0;

        for (JsonElement el : response.getAsJsonArray("holidays"))
        {
            total++;
            JsonObject h = el.getAsJsonObject();
            if (!h.has("name") || !h.has("date") || !h.get("date").isJsonObject()) continue;

            //state or region specific holidays would clutter a national calendar
            if (isRegionOnly(h)) continue;

            String name = h.get("name").getAsString().trim();
            JsonObject date = h.getAsJsonObject("date");
            if (name.isEmpty() || !date.has("iso")) continue;

            //iso can be "2026-07-04" or "2026-03-08T02:00:00-05:00", the date is always the first 10 chars
            String iso = date.get("iso").getAsString();
            if (iso.length() < 10) continue;

            LocalDate day;
            try { day = LocalDate.parse(iso.substring(0, 10)); }
            catch (Exception e) { continue; }

            if (!seen.add(day + "|" + name.toLowerCase(Locale.ROOT))) continue;

            out.add(new Holiday(day, name, shorten(name), categorize(typesOf(h))));
        }

        out.sort(Comparator.comparing((Holiday x) -> x.date).thenComparing(x -> x.name));
        LOGGER.fine("Kept " + out.size() + " of " + total + " holidays from Calendarific");
        return out;
    }

    private static boolean isRegionOnly(JsonObject h)
    {
        JsonElement states = h.get("states");
        if (states != null && states.isJsonArray() && states.getAsJsonArray().size() > 0) return true;

        JsonElement locations = h.get("locations");
        if (locations != null && locations.isJsonPrimitive())
        {
            String s = locations.getAsString().trim();
            if (!s.isEmpty() && !s.equalsIgnoreCase("All")) return true;
        }
        return false;
    }

    private static List<String> typesOf(JsonObject h)
    {
        List<String> types = new ArrayList<>();
        JsonElement t = h.get("type");
        if (t != null && t.isJsonArray())
            for (JsonElement e : (JsonArray) t) types.add(e.getAsString());
        else if (t != null && t.isJsonPrimitive())
            types.add(t.getAsString());

        JsonElement primary = h.get("primary_type");
        if (primary != null && primary.isJsonPrimitive() && !types.contains(primary.getAsString()))
            types.add(primary.getAsString());
        return types;
    }

    static String categorize(List<String> types)
    {
        boolean national = false, season = false, religious = false;

        for (String t : types)
        {
            String l = t.toLowerCase(Locale.ROOT);
            if (l.equals("national holiday")) national = true;
            else if (l.contains("season")) season = true;
            else
                for (String w : RELIGIOUS_WORDS)
                    if (l.contains(w)) { religious = true; break; }
        }

        if (national)  return HolidayCategory.FEDERAL;
        if (season)    return HolidayCategory.ASTRONOMICAL;
        if (religious) return HolidayCategory.RELIGIOUS;
        return HolidayCategory.OBSERVANCE;
    }

    /** Short label for tight calendar tiles: whole words, 16 chars max. */
    static String shorten(String name)
    {
        if (name.length() <= SHORT_NAME_MAX) return name;

        int cut = name.lastIndexOf(' ', SHORT_NAME_MAX - 3);
        if (cut < 4) cut = SHORT_NAME_MAX - 3;
        return name.substring(0, cut).trim() + "...";
    }

    private static List<Holiday> readCache(Database db, String source, int year)
    {
        if (db == null) return null;
        try
        {
            String payload = db.getCached(source, year);
            if (payload == null) return null;

            List<Holiday> out = new ArrayList<>();
            for (JsonElement el : JsonParser.parseString(payload).getAsJsonArray())
            {
                JsonObject o = el.getAsJsonObject();
                out.add(new Holiday(
                    LocalDate.parse(o.get("date").getAsString()),
                    o.get("name").getAsString(),
                    o.get("shortName").getAsString(),
                    o.get("category").getAsString()));
            }
            return out;
        }
        catch (Exception e)
        {
            LOGGER.log(Level.WARNING, "Bad holiday cache row for " + source + " " + year + ", refetching", e);
            return null;
        }
    }

    private static String enc(String s)
    {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private static final class Config
    {
        final String apiKey;   //null when missing or still the placeholder
        final String country;

        private Config(String apiKey, String country)
        {
            this.apiKey = apiKey;
            this.country = country;
        }

        //read on every call (cheap) so editing the key doesn't need an app restart
        static Config load()
        {
            Properties p = new Properties();
            File f = SystemDirectory.Directory("config.properties");

            try
            {
                if (!f.exists())
                {
                    f.getParentFile().mkdirs();
                    Files.writeString(f.toPath(), CONFIG_TEMPLATE, StandardCharsets.UTF_8);
                }
                else
                {
                    try (FileInputStream in = new FileInputStream(f)) { p.load(in); }
                }
            }
            catch (IOException e)
            {
                LOGGER.log(Level.WARNING, "Couldn't read " + f.getAbsolutePath(), e);
            }

            String key = System.getenv("CALENDARIFIC_API_KEY");
            if (key == null || key.isBlank()) key = p.getProperty("calendarific.api.key");
            key = key == null ? "" : key.trim();
            if (key.isEmpty() || key.equals(PLACEHOLDER_KEY)) key = null;

            String country = p.getProperty("calendarific.country", DEFAULT_COUNTRY).trim().toUpperCase(Locale.ROOT);
            if (country.isEmpty()) country = DEFAULT_COUNTRY;

            return new Config(key, country);
        }
    }
}