/*
Works out which dates a chat message is asking about ("next week", "in March", "March 5",
"last month", "next 10 days"), so the assistant is shown that slice of the calendar instead of
only the next two weeks. Returns {from, to, label} with from and to as "YYYY-MM-DD", or null
when the message names no period (the caller then keeps its normal range).
Pure on purpose: it takes the current date as an argument so it can be tested.
*/

/* 0 = Sunday, 1 = Monday. Only the default: chatContext.js passes the "Week starts on Monday" setting */
const WEEK_STARTS_ON = 0;
/* Never load more than a year, however far the message reaches */
const MAX_SPAN_DAYS = 366;

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_ALIASES = { jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d, weekStartsOn = WEEK_STARTS_ON) => addDays(d, -((d.getDay() - weekStartsOn + 7) % 7));

function monthIndex(word) {
  const w = word.toLowerCase();
  const full = MONTH_NAMES.indexOf(w);
  return full !== -1 ? full : (MONTH_ALIASES[w] ?? -1);
}

/* "may" and "mar" are ordinary words too, so a bare month name only counts after one of these words, or next to a day or year */
const MONTH_WORD = "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\\.?";
const LEAD = "(?:in|during|for|of|on|by|until|through|from|next|this|last|all of)";
const WITH_LEAD = new RegExp(`\\b(${LEAD})\\s+${MONTH_WORD}(?:\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*(?:am|pm|:)))?(?:,?\\s+(20\\d{2}))?`, "i");
const WITH_DAY = new RegExp(`\\b${MONTH_WORD}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*(?:am|pm|:))(?:,?\\s+(20\\d{2}))?`, "i");
const WITH_YEAR = new RegExp(`\\b${MONTH_WORD}\\s+(20\\d{2})\\b`, "i");

/* With no year given, pick the year that puts the month closest to now: up to 5 months back, up to 6 ahead */
function guessYear(month, now, lead) {
  const here = now.getFullYear() * 12 + now.getMonth();
  const candidates = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  if (lead === "last") {
    /* "last March" is the most recent one that has finished */
    const past = candidates.filter((y) => y * 12 + month < here);
    return past[past.length - 1];
  }
  const fits = candidates.find((y) => {
    const diff = y * 12 + month - here;
    return diff >= -5 && diff <= 6;
  });
  return fits ?? now.getFullYear();
}

function span(from, to, label) {
  /* Cap very long ranges, counted from the start */
  const days = Math.round((to - from) / 86400000);
  const end = days > MAX_SPAN_DAYS ? addDays(from, MAX_SPAN_DAYS) : to;
  return { from: keyOf(from), to: keyOf(end), label };
}

export function detectRange(text, now = new Date(), weekStartsOn = WEEK_STARTS_ON) {
  if (!text) return null;
  const t = String(text);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const short = (d) => d.toLocaleDateString([], {
    month: "short", day: "numeric", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
  const monthLabel = (y, m) => new Date(y, m, 1).toLocaleDateString([], { month: "long", year: "numeric" });
  const range = (from, to) => (keyOf(from) === keyOf(to) ? short(from) : `${short(from)} to ${short(to)}`);

  /* A named month, with or without a day or year */
  let m = t.match(WITH_LEAD);
  let lead = null, monthWord = null, day = null, year = null;
  if (m) {
    [, lead, monthWord, day, year] = m;
    lead = lead.toLowerCase();
  } else if ((m = t.match(WITH_DAY))) {
    [, monthWord, day, year] = m;
  } else if ((m = t.match(WITH_YEAR))) {
    [, monthWord, year] = m;
  }
  if (monthWord) {
    const month = monthIndex(monthWord);
    if (month !== -1) {
      const y = year ? Number(year) : guessYear(month, today, lead);
      if (day) {
        const date = new Date(y, month, Number(day));
        if (date.getMonth() === month) return span(date, date, short(date));
      } else {
        const first = new Date(y, month, 1);
        const last = new Date(y, month + 1, 0);
        return span(first, last, monthLabel(y, month));
      }
    }
  }

  const s = t.toLowerCase();

  if (/\bday after tomorrow\b/.test(s)) {
    const d = addDays(today, 2);
    return span(d, d, short(d));
  }
  if (/\byesterday\b/.test(s)) {
    const d = addDays(today, -1);
    return span(d, d, short(d));
  }

  if (/\bthis weekend\b/.test(s)) {
    const sat = addDays(today, (6 - today.getDay() + 7) % 7);
    const from = today.getDay() === 0 ? today : sat;
    const to = today.getDay() === 0 ? today : addDays(sat, 1);
    return span(from, to, `this weekend (${range(from, to)})`);
  }

  const week = startOfWeek(today, weekStartsOn);
  if (/\bnext week\b/.test(s)) return span(addDays(week, 7), addDays(week, 13), `next week (${range(addDays(week, 7), addDays(week, 13))})`);
  if (/\bthis week\b/.test(s)) return span(week, addDays(week, 6), `this week (${range(week, addDays(week, 6))})`);
  if (/\blast week\b/.test(s)) return span(addDays(week, -7), addDays(week, -1), `last week (${range(addDays(week, -7), addDays(week, -1))})`);

  const thisMonth = [today.getFullYear(), today.getMonth()];
  const monthSpan = (offset, word) => {
    const first = new Date(thisMonth[0], thisMonth[1] + offset, 1);
    const last = new Date(thisMonth[0], thisMonth[1] + offset + 1, 0);
    return span(first, last, `${word} (${monthLabel(first.getFullYear(), first.getMonth())})`);
  };
  if (/\bnext month\b/.test(s)) return monthSpan(1, "next month");
  if (/\bthis month\b/.test(s)) return monthSpan(0, "this month");
  if (/\blast month\b/.test(s)) return monthSpan(-1, "last month");

  const yearSpan = (offset, word) => {
    const y = today.getFullYear() + offset;
    return span(new Date(y, 0, 1), new Date(y, 11, 31), `${word} (${y})`);
  };
  if (/\bnext year\b/.test(s)) return yearSpan(1, "next year");
  if (/\blast year\b/.test(s)) return yearSpan(-1, "last year");
  if (/\bthis year\b/.test(s)) return yearSpan(0, "this year");

  /* "next 10 days", "next 3 weeks", "past 2 weeks" */
  const ahead = s.match(/\b(?:next|coming)\s+(\d{1,3})\s+(day|week|month)s?\b/);
  if (ahead) {
    const n = Number(ahead[1]);
    const unit = ahead[2];
    const to = unit === "day" ? addDays(today, n)
      : unit === "week" ? addDays(today, n * 7)
      : new Date(today.getFullYear(), today.getMonth() + n, today.getDate());
    return span(today, to, `the next ${n} ${unit}${n === 1 ? "" : "s"} (${range(today, to)})`);
  }
  const back = s.match(/\b(?:last|past|previous)\s+(\d{1,3})\s+(day|week|month)s?\b/);
  if (back) {
    const n = Number(back[1]);
    const unit = back[2];
    const from = unit === "day" ? addDays(today, -n)
      : unit === "week" ? addDays(today, -n * 7)
      : new Date(today.getFullYear(), today.getMonth() - n, today.getDate());
    return span(from, today, `the last ${n} ${unit}${n === 1 ? "" : "s"} (${range(from, today)})`);
  }

  return null;
}