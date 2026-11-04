import { alarms as alarmsApi } from "../../shared/lib/api.js";
import { isRangeSet, rangeLabel, rangeQuery } from "../calendar/alarmRange.js";
import { dedupeAlarms } from "../alarms/alarmUtils.js";
import { dateKey } from "../calendar/calendarUtils.js";
import { amountsOf, formatMoney, formatTotals, sumAmounts } from "../../shared/text/money.js";

const DAYS_AHEAD = 14;
const MAX_EVENTS = 80;

const timeOf = (a) => new Date(a.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/* Currency amounts the app found in the event, so the model reads them instead of guessing */
function amountNote(a) {
  const found = amountsOf(a);
  return found.length ? ` [amounts: ${found.map((x) => formatMoney(x.symbol, x.cents)).join(", ")}]` : "";
}

/* The [#id] lets the assistant name an event when it proposes an edit or a delete; the backend checks it */
const describe = (a) => `[#${a.id}] ${a.title} at ${timeOf(a)}${a.desc ? ` (${a.desc})` : ""}${amountNote(a)}`;

function dayHeading(key) {
  return new Date(`${key}T00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

/* Events grouped under a heading per day, one line each, with the day's amounts added up */
function byDay(events) {
  const days = new Map();
  for (const a of events) {
    const key = a.time.slice(0, 10);
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(a);
  }
  return [...days].map(([key, list]) => {
    const total = formatTotals(sumAmounts(list));
    return `${dayHeading(key)}${total ? ` (amounts that day add up to ${total})` : ""}: ${list.map(describe).join("; ")}`;
  }).join("\n");
}

/* Small models are bad at arithmetic, so the app adds the amounts and the model quotes the result */
function totalLine(shown, truncated) {
  const total = formatTotals(sumAmounts(shown));
  if (!total) return "No money amounts are written in these events.";
  const partial = truncated ? " This total is partial, because the list was cut off." : "";
  return `Money amounts written in the listed events add up to ${total}. The app added these up: quote these totals and do not do your own arithmetic. For any other group of events, add the [amounts: ...] shown on each event one by one.${partial}`;
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
    const shown = events.slice(0, MAX_EVENTS);
    lines.push(events.length
      ? `The user's calendar events for ${scope}, by day:\n${byDay(shown)}`
      : `The user has no calendar events for ${scope}.`);
    if (events.length) lines.push(totalLine(shown, events.length > MAX_EVENTS));
  } else {
    const todays = events.filter(a => a.time.startsWith(todayKey));
    const later = events.filter(a => !a.time.startsWith(todayKey));
    const laterShown = later.slice(0, MAX_EVENTS);
    lines.push(todays.length
      ? `Events today: ${todays.map(describe).join("; ")}.`
      : "The user has no events today.");
    lines.push(later.length
      ? `Events in the next ${DAYS_AHEAD} days, by day:\n${byDay(laterShown)}`
      : `The user has nothing else in the next ${DAYS_AHEAD} days.`);
    if (events.length) lines.push(totalLine([...todays, ...laterShown], later.length > MAX_EVENTS));
  }
  return lines.join("\n");
}
