package com.zachery.customcalendar.Holidays;

/**
 * Category labels applied to each {@link Holiday}. Constant names dropped the
 * CATEGORY_ prefix now that the enclosing class name supplies that context
 * (e.g. {@code HolidayCategory.FEDERAL}).
 */
public final class HolidayCategory
{
    public static final String FEDERAL      = "federal";
    public static final String OBSERVANCE   = "observance";
    public static final String RELIGIOUS    = "religious";
    public static final String ASTRONOMICAL = "astronomical";

    private HolidayCategory() {}
}