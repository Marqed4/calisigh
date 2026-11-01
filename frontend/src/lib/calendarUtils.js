export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* Local YYYY-MM-DD (toISOString would shift evening dates to the next day in UTC) */
export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function startOfWeek(date) {
  return addDays(date, -date.getDay());
}

/* 42 cells so the grid keeps its height; outside days are real dates */
export function getMonthCells(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function getWeekDays(date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function alarmsOn(alarms, date) {
  const key = dateKey(date);
  return alarms
    .filter(a => a.time?.startsWith(key))
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function weekLabel(date) {
  const days = getWeekDays(date);
  const a = days[0];
  const b = days[6];
  const mon = d => d.toLocaleString("default", { month: "short" });
  if (a.getFullYear() !== b.getFullYear()) {
    return `${mon(a)} ${a.getDate()}, ${a.getFullYear()} - ${mon(b)} ${b.getDate()}, ${b.getFullYear()}`;
  }
  if (a.getMonth() !== b.getMonth()) {
    return `${mon(a)} ${a.getDate()} - ${mon(b)} ${b.getDate()}, ${b.getFullYear()}`;
  }
  return `${mon(a)} ${a.getDate()} - ${b.getDate()}, ${b.getFullYear()}`;
}
