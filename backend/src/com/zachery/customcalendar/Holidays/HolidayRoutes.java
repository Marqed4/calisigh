package com.zachery.customcalendar.Holidays;

import java.io.IOException;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import com.zachery.customcalendar.Http.Json;
import com.zachery.customcalendar.Http.Json.Message;
import com.zachery.customcalendar.Http.Routes;
import com.zachery.customcalendar.Http.Routes.BadRequest;

import static spark.Spark.get;
import static spark.Spark.put;

public class HolidayRoutes {

    record KeyStatus(boolean set, String country) {}

    static class KeyRequest {
        String key, country;
    }

    // ?year=2026&categories=federal,religious (both optional)
    public void register() {
        get("/api/holidays", Routes.json("GET /api/holidays", (req, res) -> {
            String yearParam = req.queryParams("year");
            int year = yearParam != null ? Integer.parseInt(yearParam) : LocalDate.now().getYear();

            List<Holiday> all = HolidaysMaster.forYear(year);

            String categories = req.queryParams("categories");
            if (categories != null && !categories.isBlank()) {
                Set<String> wanted = Set.copyOf(Arrays.asList(categories.split(",")));
                all = all.stream().filter(h -> wanted.contains(h.category)).collect(Collectors.toList());
            }
            return all;
        }));

        // whether a Calendarific key is set; the key itself is never sent back
        get("/api/holidays/key", Routes.json("GET /api/holidays/key", (req, res) ->
            new KeyStatus(CalendarificHolidays.hasKey(), CalendarificHolidays.country())));

        // checks the key with Calendarific before saving it
        put("/api/holidays/key", Routes.json("PUT /api/holidays/key", (req, res) -> {
            KeyRequest body = Json.GSON.fromJson(req.body(), KeyRequest.class);
            if (body == null) throw new BadRequest("Send {key, country}.");
            try {
                CalendarificHolidays.saveKey(body.key, body.country);
            } catch (IOException e) {
                throw new BadRequest(e.getMessage());
            }
            return new Message("Holidays are on.");
        }));
    }
}
