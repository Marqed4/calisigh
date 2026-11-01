package com.zachery.customcalendar;

import java.util.List;

import com.zachery.customcalendar.Holidays.CalendarificHolidays;
import com.zachery.customcalendar.Holidays.Holiday;

public class HolidaysMaster
{
    /** All holidays come from Calendarific (cached in SQLite). */
    public static List<Holiday> forYear(int year)
    {
        return CalendarificHolidays.forYear(year);
    }
}