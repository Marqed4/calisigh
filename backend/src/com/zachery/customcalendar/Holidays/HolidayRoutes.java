package com.zachery.customcalendar.Holidays;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import com.zachery.customcalendar.Http.Routes;

import static spark.Spark.get;

public class HolidayRoutes {

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
    }
}
