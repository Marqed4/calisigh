package com.zachery.customcalendar.Assistant;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;

/*
How the assistant proposes a calendar event. The model ends its reply with one tag line holding
the event as JSON; this class tells the model about the format and reads the tag back out.
*/
public final class EventTag {

    private EventTag() {}

    private static final Gson GSON = new Gson();
    private static final Pattern TAG = Pattern.compile("\\[\\[EVENT:?\\s*(\\{.*?\\})\\s*\\]\\]", Pattern.DOTALL);
    private static final Pattern ANY_TAG = Pattern.compile("\\[\\[EVENT.*?\\]\\]", Pattern.DOTALL);

    private static final String FORMAT =
        "[[EVENT {\"title\": \"<short title>\", \"date\": \"YYYY-MM-DD\", \"time\": \"HH:mm\", \"notes\": [\"<consideration>\", \"<consideration>\"]}]]";

    /** A validated event the user can add with one click. */
    public static class Proposal {
        public String title;
        public String time;          // ISO local date and time
        public List<String> notes;   // things that help pull the event off
    }

    public record Result(String text, Proposal proposal) {}

    private static class Raw {
        String title, date, time;
        List<String> notes;
    }

    /** Prompt text: today's date, how to create an event, and optionally to volunteer one. */
    public static String instructions(LocalDateTime now, boolean volunteer) {
        LocalDateTime t = now.withSecond(0).withNano(0);
        String text = " Right now it is " + t + " (" + t.getDayOfWeek() + "). " +
            "If the user asks you to add, schedule, create or remind them about something, confirm it in one or two " +
            "sentences in your voice. Fill in anything they left out with sensible choices: pick a time if they gave none, " +
            "turn words like tomorrow or Friday into a real future date, and make up a short title if needed. " +
            "Also think of 2 to 4 short considerations that help them pull it off, like what to bring, when to leave, " +
            "what to prepare or what to remember. Then end the reply with exactly one line in this format: " + FORMAT + " " +
            "Only write that line when the user actually asks for an event or when you suggest one yourself.";
        if (volunteer) {
            text += " In this reply, after answering, also casually suggest ONE new calendar event the user could add, " +
                "based on what you have talked about or gaps in their calendar. Keep the suggestion to one sentence in your " +
                "voice and end with the event line.";
        }
        return text;
    }

    /** Splits a reply into its visible text and the proposed event, if the model wrote a valid, future one. */
    public static Result extract(String content, LocalDateTime now) {
        String text = ANY_TAG.matcher(content).replaceAll("").strip();
        Matcher m = TAG.matcher(content);
        if (!m.find()) return new Result(text, null);

        try {
            Raw raw = GSON.fromJson(m.group(1), Raw.class);
            if (raw == null || raw.title == null || raw.title.isBlank() || raw.date == null || raw.time == null) {
                return new Result(text, null);
            }
            String clock = raw.time.strip();
            LocalDateTime when = LocalDateTime.of(LocalDate.parse(raw.date.strip()),
                LocalTime.parse(clock.length() == 4 ? "0" + clock : clock));
            if (!when.isAfter(now)) return new Result(text, null);

            Proposal p = new Proposal();
            p.title = raw.title.strip().substring(0, Math.min(80, raw.title.strip().length()));
            p.time = when.toString();
            p.notes = new ArrayList<>();
            if (raw.notes != null) {
                for (String note : raw.notes) {
                    if (note != null && !note.isBlank() && p.notes.size() < 6) {
                        p.notes.add(note.strip().substring(0, Math.min(120, note.strip().length())));
                    }
                }
            }
            return new Result(text, p);
        } catch (JsonSyntaxException | DateTimeParseException e) {
            // the model got the format wrong, so there is just no event card
            return new Result(text, null);
        }
    }
}
