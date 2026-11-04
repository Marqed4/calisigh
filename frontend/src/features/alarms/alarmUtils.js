const pad = (n) => String(n).padStart(2, "0");

/* Local-time ISO string in the same format the backend already uses */
export function toLocalIso(date, time) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${time}:00`;
}

/* "HH:MM" for a Date, in local time */
export function toHHMM(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/*
  Timestamps for the repeats AFTER the first alarm, up to and including endDate
  ("YYYY-MM-DD" from a date input). mode is "weekly" or "yearly".
  Computed from the start date each time so Feb 29 etc. can't drift.
*/
export function repeatIsos({ year, month, day, time, endDate, mode, cap = 520 }) {
  const [ey, em, ed] = endDate.split("-").map(Number);
  const end = new Date(ey, em - 1, ed);
  const y = Number(year), m = Number(month) - 1, d = Number(day);
  const out = [];
  for (let i = 1; i <= cap; i++) {
    const next = mode === "yearly" ? new Date(y + i, m, d) : new Date(y, m, d + 7 * i);
    if (next > end) break;
    out.push(toLocalIso(next, time));
  }
  return out;
}

/* Alarms with the same time, title and description are one event to the user */
export const alarmKey = (a) => `${a.time}|${a.title}|${a.desc ?? ""}`;

export function dedupeAlarms(list) {
  const seen = new Set();
  return list.filter(a => {
    const key = alarmKey(a);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
