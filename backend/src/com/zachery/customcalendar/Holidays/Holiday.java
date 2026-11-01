package com.zachery.customcalendar.Holidays;

import java.time.LocalDate;

/**
 * Immutable value object representing a single holiday on a single date.
 * The constructor is package-private so only the provider classes in this
 * package can build instances.
 */
public class Holiday
{
    public final String date; // "YYYY-MM-DD"
    public final String name;
    public final String shortName;
    public final String category;

    Holiday(LocalDate date, String name, String shortName, String category)
    {
        this.date      = date.toString();
        this.name      = name;
        this.shortName = shortName;
        this.category  = category;
    }
}
