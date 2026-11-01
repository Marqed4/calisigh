package com.zachery.customcalendar;

import java.util.List;

import com.zachery.customcalendar.ObservationsHolidays.CalendarificHolidays;
import com.zachery.customcalendar.ObservationsHolidays.Holiday;

public class ObservancesHolidaysMaster
{
    /** All holidays now come from Calendarific (cached in SQLite). Same signature as before. */
    public static List<Holiday> forYear(int year)
    {
        return CalendarificHolidays.forYear(year);
    }
}
