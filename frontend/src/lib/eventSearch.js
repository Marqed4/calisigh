import { formatTime } from "./calendarUtils.js";

/* Search filters: free text (title, notes, time, date) plus optional date and time-of-day ranges */
export const emptyFilters = () => ({ text: "", from: "", to: "", timeFrom: "", timeTo: "" });

export const isActive = (f) =>
  f.text.trim() !== "" || Boolean(f.from || f.to || f.timeFrom || f.timeTo);

/* Same key the views use to look an alarm up in the matched set */
export const matchKey = (a) => a.id ?? a.time;

/* Everything a word can match: title, notes, "09:30", "9:30 AM", "2026-11-05", "11/5/2026", "Thursday", "November" */
function haystack(a) {
  const d = new Date(a.time);
  return [
    a.title,
    a.desc ?? "",
    a.time.slice(11, 16),
    formatTime(a.time),
    a.time.slice(0, 10),
    `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`,
    d.toLocaleDateString([], { weekday: "long", month: "long" }),
  ].join(" ").toLowerCase();
}

export function eventMatches(a, f) {
  const date = a.time.slice(0, 10);
  const hm = a.time.slice(11, 16);
  if (f.from && date < f.from) return false;
  if (f.to && date > f.to) return false;
  if (f.timeFrom && hm < f.timeFrom) return false;
  if (f.timeTo && hm > f.timeTo) return false;
  const words = f.text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = haystack(a);
  return words.every((w) => hay.includes(w));
}

/* Upcoming matches first, soonest to latest, then past ones, newest to oldest */
export function findEvents(alarms, f) {
  if (!isActive(f)) return [];
  const t = new Date();
  const now = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const hits = alarms.filter((a) => eventMatches(a, f));
  return [
    ...hits.filter((a) => a.time >= now).sort((a, b) => a.time.localeCompare(b.time)),
    ...hits.filter((a) => a.time < now).sort((a, b) => b.time.localeCompare(a.time)),
  ];
}
