package com.zachery.customcalendar;

import java.time.LocalDateTime;

public record AlarmRecord(long id, LocalDateTime time, String title, String desc) implements Comparable<AlarmRecord>
{
    @Override
    public int compareTo(AlarmRecord other)
    {
        int c = this.time.compareTo(other.time);
        return c != 0 ? c : Long.compare(this.id, other.id);
    }
}
