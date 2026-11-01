package com.zachery.customcalendar.Assistant;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.function.LongSupplier;

/*
Decides when the assistant may suggest a calendar event. Each chat session keeps a few
metrics, and every user message is a chance to suggest, weighted by how much active
conversation time passed since the previous message. That makes suggestions a Poisson
process over active time. A rate of 0.11 per minute works out to about 1.5 suggestions per
15 minutes of chatting (the skipped first message and the cooldown trim it a little), no
matter how fast or slow the user types.
*/
public class SuggestionPacer {

    static final double RATE_PER_MINUTE = 0.11;
    static final long MIN_GAP_MS = 10_000;     // fast typers still count as some time passing
    static final long MAX_GAP_MS = 120_000;    // time away from the chat does not count
    static final long COOLDOWN_MS = 60_000;    // never two suggestions back to back

    public static class Metrics {
        public int messages;
        public double activeMinutes;
        public int suggestions;
        long activeMs;
        long lastMessageAt;
        long lastSuggestionAt;

        Metrics copy() {
            Metrics c = new Metrics();
            c.messages = messages;
            c.activeMinutes = Math.round(activeMs / 600.0) / 100.0;
            c.suggestions = suggestions;
            return c;
        }
    }

    public record Decision(boolean suggest, Metrics metrics) {}

    private final Map<Long, Metrics> sessions = new HashMap<>();
    private final Random random;
    private final LongSupplier clock;

    public SuggestionPacer() {
        this(new Random(), System::currentTimeMillis);
    }

    SuggestionPacer(Random random, LongSupplier clock) {
        this.random = random;
        this.clock = clock;
    }

    public synchronized Decision onUserMessage(long sessionId) {
        long now = clock.getAsLong();
        Metrics m = sessions.computeIfAbsent(sessionId, k -> new Metrics());

        long gap = m.lastMessageAt == 0
            ? MIN_GAP_MS
            : Math.max(MIN_GAP_MS, Math.min(MAX_GAP_MS, now - m.lastMessageAt));
        m.messages++;
        m.activeMs += gap;
        m.lastMessageAt = now;

        boolean suggest = false;
        boolean coolingDown = m.lastSuggestionAt != 0 && now - m.lastSuggestionAt < COOLDOWN_MS;
        if (m.messages > 1 && !coolingDown) {
            double chance = 1 - Math.exp(-RATE_PER_MINUTE * gap / 60_000.0);
            suggest = random.nextDouble() < chance;
        }
        if (suggest) {
            m.suggestions++;
            m.lastSuggestionAt = now;
        }
        return new Decision(suggest, m.copy());
    }
}
