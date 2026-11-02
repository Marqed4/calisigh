package com.zachery.customcalendar.Assistant;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.function.LongFunction;
import java.util.regex.Pattern;

import com.google.gson.Gson;
import com.google.gson.JsonParseException;
import com.zachery.customcalendar.Alarms.AlarmRecord;

/*
How the assistant proposes a calendar change. The model ends its reply with one tag line holding
the change as JSON: [[EVENT {...}]] to add, [[EDIT {...}]] or [[DELETE {...}]] for an event that is
already in the calendar information it was given (named by its id). Nothing is ever changed here; the
user gets a card with a confirm button. This class tells the model about the formats and reads the tag back out.
Small models drift from the format, so reading is forgiving (code fences, one bracket, "9 PM")
and every silent drop is logged so a missing card can be explained from the console.
*/
public final class EventTag {

    private EventTag() {}

    private static final Gson GSON = new Gson();
    // [[EVENT {...}]], [[EVENT: {...}]] or [EVENT {...}], and the same for EDIT and DELETE
    private static final Pattern TAG = Pattern.compile("\\[\\[?\\s*(EVENT|EDIT|DELETE)\\s*:?\\s*(\\{.*?\\})\\s*\\]\\]?", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
    // leftovers of a tag that is too broken to read, so the user never sees raw tag text
    private static final Pattern ANY_TAG = Pattern.compile("\\[\\[\\s*(EVENT|EDIT|DELETE).*?(?:\\]\\]|\\z)", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
    // the "[#12]" the model sees in front of each event; it should not repeat it
    private static final Pattern EVENT_REF = Pattern.compile("\\s*\\[#\\d+\\]");
    private static final Pattern FENCE = Pattern.compile("```[a-zA-Z]*");
    private static final Pattern CLOCK = Pattern.compile("^(\\d{1,2})(?::(\\d{2}))?\\s*([ap])?\\.?m?\\.?$");

    // long enough to hold a note and a full web address
    private static final int MAX_NOTE = 300;

    private static final String FORMAT =
        "[[EVENT {\"title\": \"<short title>\", \"date\": \"YYYY-MM-DD\", \"time\": \"HH:mm\", \"notes\": [\"<consideration>\", \"<consideration>\"]}]]";

    private static final String EDIT_FORMAT = "[[EDIT {\"id\": 12, \"date\": \"YYYY-MM-DD\", \"time\": \"HH:mm\"}]]";
    private static final String DELETE_FORMAT = "[[DELETE {\"id\": 12}]]";

    /** A validated event the user can add with one click. */
    public static class Proposal {
        public String title;
        public String time;          // ISO local date and time
        public List<String> notes;   // things that help pull the event off
    }

    /** An edit or delete of an event that exists. title and time are how the event is now. */
    public static class Change {
        public String kind;          // "edit" or "delete"
        public long id;
        public String title;
        public String time;          // ISO local date and time
        public String newTitle;      // edit only, null when the title stays
        public String newTime;       // edit only, null when the time stays
    }

    public record Result(String text, Proposal proposal, Change change) {
        public Result(String text, Proposal proposal) { this(text, proposal, null); }
    }

    private static class Raw {
        Long id;
        String title, date, time;
        List<String> notes;
    }

    /** Prompt text: today's date, how to propose an event, and optionally to volunteer one. */
    public static String instructions(LocalDateTime now, boolean volunteer) {
        LocalDateTime t = now.withSecond(0).withNano(0);
        String text = " Right now it is " + t + " (" + t.getDayOfWeek() + "). " +
            "You cannot add anything to the calendar yourself. When you write the event line below, the app shows the user " +
            "a card with an Add to calendar button under your reply, and only their tap adds it. " +
            "So if the user asks you to add, schedule, create or remind them about something, tell them in one or two " +
            "sentences in your voice that you lined it up and they can tap the button. " +
            "Never say it is already added, saved, set or on their calendar. " +
            "Fill in anything they left out with sensible choices: pick a time if they gave none, " +
            "turn words like tomorrow or Friday into a real future date, and make up a short title if needed. " +
            "Also think of 2 to 4 short considerations that help them pull it off, like what to bring, when to leave, " +
            "what to prepare or what to remember. Whenever a consideration is helped by a link, put the full web address in it " +
            "(starting with https://) so the user can click it: a map link such as " +
            "https://www.google.com/maps/search/?api=1&query=Place+Name+City for a place, a search link such as " +
            "https://www.google.com/search?q=what+to+look+up for tickets, menus, recipes or hours, or the official site " +
            "of a well-known business. Build links from search terms. Never invent a deep page address you are not sure exists. " +
            "Then end the reply with exactly one line in this format, copied exactly, on its own line, " +
            "with no code fences, a 24 hour time and a full date: " + FORMAT + " " +
            "Only write that line when the user actually asks for an event or when you suggest one yourself. " +
            "To change or remove an event that is listed in the calendar information, end the reply with one line instead: " +
            EDIT_FORMAT + " or " + DELETE_FORMAT + ". Use the number after the # in the square brackets in front of that event " +
            "as the id, and in an edit include only what changes (title, date or time). Never say those numbers out loud and " +
            "never use an id that is not in the calendar information. The same rule holds: you cannot change or remove anything " +
            "yourself, the user gets a card with a button and only their tap does it, so never say it is already changed or deleted. " +
            "Write at most one such line per reply.";
        if (volunteer) {
            text += " In this reply, after answering, also casually suggest ONE new calendar event the user could add, " +
                "based on what you have talked about or gaps in their calendar. Keep the suggestion to one sentence in your " +
                "voice and end with the event line.";
        }
        return text;
    }

    /** Splits a reply into its visible text and a proposed add, if the model wrote a valid, future one. */
    public static Result extract(String content, LocalDateTime now) {
        return extract(content, now, null);
    }

    /**
     * Same, and also reads EDIT and DELETE tags. lookup finds an alarm by id (null when there is none);
     * without it those tags are dropped.
     */
    public static Result extract(String content, LocalDateTime now, LongFunction<AlarmRecord> lookup) {
        String cleaned = FENCE.matcher(content).replaceAll("");
        String text = TAG.matcher(cleaned).replaceAll("");
        text = ANY_TAG.matcher(text).replaceAll("");
        text = EVENT_REF.matcher(text).replaceAll("").strip();

        Matcher m = TAG.matcher(cleaned);
        if (!m.find()) {
            if (cleaned.toUpperCase().contains("EVENT")
                    && (cleaned.contains("\"date\"") || cleaned.contains("\"title\"")))
                System.out.println("EventTag: reply looks like it holds an event but no readable tag was found");
            return new Result(text, null);
        }

        String kind = m.group(1).toUpperCase();
        String json = m.group(2);
        try {
            Raw raw = GSON.fromJson(json, Raw.class);
            if (raw == null) return drop(text, "empty tag: " + json);
            return switch (kind) {
                case "EDIT" -> edit(text, raw, now, lookup);
                case "DELETE" -> delete(text, raw, lookup);
                default -> add(text, raw, now);
            };
        } catch (JsonParseException | DateTimeParseException e) {
            return drop(text, "could not read the event: " + e.getMessage());
        }
    }

    private static Result add(String text, Raw raw, LocalDateTime now) {
        if (raw.title == null || raw.title.isBlank() || raw.date == null || raw.time == null) {
            return drop(text, "title, date or time is missing for " + GSON.toJson(raw));
        }
        LocalTime clock = parseClock(raw.time);
        if (clock == null) return drop(text, "time not understood: " + raw.time);

        LocalDateTime when = LocalDateTime.of(LocalDate.parse(raw.date.strip()), clock);
        if (!when.isAfter(now)) return drop(text, "event is not in the future: " + when + " (now " + now.withNano(0) + ")");

        Proposal p = new Proposal();
        p.title = raw.title.strip().substring(0, Math.min(80, raw.title.strip().length()));
        p.time = when.toString();
        p.notes = new ArrayList<>();
        if (raw.notes != null) {
            for (String note : raw.notes) {
                if (note != null && !note.isBlank() && p.notes.size() < 6) {
                    p.notes.add(note.strip().substring(0, Math.min(MAX_NOTE, note.strip().length())));
                }
            }
        }
        return new Result(text, p);
    }

    private static AlarmRecord find(Raw raw, LongFunction<AlarmRecord> lookup) {
        if (raw.id == null || lookup == null) return null;
        return lookup.apply(raw.id);
    }

    private static Result delete(String text, Raw raw, LongFunction<AlarmRecord> lookup) {
        AlarmRecord current = find(raw, lookup);
        if (current == null) return drop(text, "no event with id " + raw.id + " to delete");

        Change c = new Change();
        c.kind = "delete";
        c.id = current.id();
        c.title = current.title();
        c.time = current.time().toString();
        return new Result(text, null, c);
    }

    private static Result edit(String text, Raw raw, LocalDateTime now, LongFunction<AlarmRecord> lookup) {
        AlarmRecord current = find(raw, lookup);
        if (current == null) return drop(text, "no event with id " + raw.id + " to edit");

        String title = raw.title == null ? "" : raw.title.strip();
        if (title.length() > 80) title = title.substring(0, 80);
        boolean titleChanges = !title.isEmpty() && !title.equals(current.title());

        LocalDate date = raw.date == null || raw.date.isBlank() ? current.time().toLocalDate() : LocalDate.parse(raw.date.strip());
        LocalTime clock = current.time().toLocalTime();
        if (raw.time != null && !raw.time.isBlank()) {
            clock = parseClock(raw.time);
            if (clock == null) return drop(text, "time not understood: " + raw.time);
        }
        LocalDateTime when = LocalDateTime.of(date, clock).withSecond(0).withNano(0);
        boolean timeChanges = !when.equals(current.time().withSecond(0).withNano(0));

        if (!titleChanges && !timeChanges) return drop(text, "edit of event " + current.id() + " changes nothing");
        if (timeChanges && !when.isAfter(now)) return drop(text, "new time is not in the future: " + when + " (now " + now.withNano(0) + ")");

        Change c = new Change();
        c.kind = "edit";
        c.id = current.id();
        c.title = current.title();
        c.time = current.time().toString();
        c.newTitle = titleChanges ? title : null;
        c.newTime = timeChanges ? when.toString() : null;
        return new Result(text, null, c);
    }

    private static Result drop(String text, String why) {
        System.out.println("EventTag: no card because " + why);
        return new Result(text, null);
    }

    /** "21:00", "9:00", "9 PM", "9pm", "9:30 p.m." or "9" (read as 24 hour). */
    static LocalTime parseClock(String raw) {
        Matcher m = CLOCK.matcher(raw.strip().toLowerCase());
        if (!m.matches()) return null;
        int hour = Integer.parseInt(m.group(1));
        int minute = m.group(2) == null ? 0 : Integer.parseInt(m.group(2));
        if (m.group(3) != null) {
            if (hour < 1 || hour > 12) return null;
            hour = hour % 12 + (m.group(3).equals("p") ? 12 : 0);
        }
        if (hour > 23 || minute > 59) return null;
        return LocalTime.of(hour, minute);
    }
}
