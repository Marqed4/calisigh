import { alarms as alarmsApi } from "./api.js";
import { isRangeSet, rangeLabel, rangeQuery } from "./alarmRange.js";
import { dedupeAlarms } from "./alarmUtils.js";
import { dateKey } from "./calendarUtils.js";

const DAYS_AHEAD = 14;
const MAX_EVENTS = 80;

const timeOf = (a) => new Date(a.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const describe = (a) => `${a.title} at ${timeOf(a)}${a.desc ? ` (${a.desc})` : ""}`;

function dayHeading(key) {
  return new Date(`${key}T00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

/* Events grouped under a heading per day, one line each */
function byDay(events) {
  const days = new Map();
  for (const a of events) {
    const key = a.time.slice(0, 10);
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(describe(a));
  }
  return [...days].map(([key, items]) => `${dayHeading(key)}: ${items.join("; ")}`).join("\n");
}

/*
What the assistant is told about the calendar. Small models guess when handed a whole
calendar, so it gets the current date and only a focused slice: the range the user picked,
or else today and the next two weeks.
*/
export async function loadAlarmContext(range) {
  const today = new Date();
  const todayKey = dateKey(today);
  const limit = new Date(today.getFullYear(), today.getMonth(), today.getDate() + DAYS_AHEAD);

  const query = isRangeSet(range) ? range : { from: todayKey, to: dateKey(limit) };

  let events = [];
  try {
    events = dedupeAlarms(await alarmsApi.list(rangeQuery(query))).sort((a, b) => a.time.localeCompare(b.time));
  } catch (_) {}

  const now = today.toLocaleString([], { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const lines = [`Right now it is ${now}.`];

  if (isRangeSet(range)) {
    const scope = rangeLabel(range);
    lines.push(events.length
      ? `The user's calendar events for ${scope}, by day:\n${byDay(events.slice(0, MAX_EVENTS))}`
      : `The user has no calendar events for ${scope}.`);
  } else {
    const todays = events.filter(a => a.time.startsWith(todayKey));
    const later = events.filter(a => !a.time.startsWith(todayKey));
    lines.push(todays.length
      ? `Events today: ${todays.map(describe).join("; ")}.`
      : "The user has no events today.");
    lines.push(later.length
      ? `Events in the next ${DAYS_AHEAD} days, by day:\n${byDay(later.slice(0, MAX_EVENTS))}`
      : `The user has nothing else in the next ${DAYS_AHEAD} days.`);
  }
  return lines.join("\n");
}
