package com.zachery.customcalendar.Holidays;

import java.util.List;


public class HolidaysMaster
{
    /** All holidays come from Calendarific (cached in SQLite). */
    public static List<Holiday> forYear(int year)
    {
        return CalendarificHolidays.forYear(year);
    }
}