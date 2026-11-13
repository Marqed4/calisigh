/*
Currency amounts written in event text: a currency symbol, then a number ("$50", "$1,250.50", "€20", "$5k").
One place knows the pattern, so the highlighting, the search total and the chat assistant agree:
what is coloured is exactly what is added up. Sums use whole cents so 0.1 + 0.2 never drifts.

Rules that keep that true:
- Amounts inside a web address are ignored everywhere (the link shows as a link, not as money).
- A number that could be read two ways is left alone rather than guessed: "$1.234" and "€20,50" are
  neither coloured nor counted, so a wrong total never hides behind a coloured amount.
- Only a space (or a non-breaking space) may sit between the symbol and the number, never a line break.
- An amount too large to add up exactly is ignored.
*/
import { splitUrls } from "./urls.js";

const SYMBOLS = "$€£¥₹₩₽₺₪฿₫";
const SOURCE = `([+-]?)([${SYMBOLS}])[ \\u00a0]?(\\d{1,3}(?:,\\d{3})+|\\d+)(\\.\\d{1,2})?([kKmM])?(?!\\w|[.,]\\d)`;
const MULTIPLIER = { k: 1e3, m: 1e6 };

/* A fresh regex each call, because a global regex remembers where it stopped */
export const moneyPattern = () => new RegExp(SOURCE, "g");

export function formatMoney(symbol, cents) {
  const magnitude = Math.abs(cents);
  const whole = magnitude % 100 === 0;
  const text = (magnitude / 100).toLocaleString("en-US", whole
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${cents < 0 ? "-" : ""}${symbol}${text}`;
}

function toCents(m) {
  const base = Math.round(parseFloat(m[3].replace(/,/g, "") + (m[4] ?? "")) * 100);
  const cents = base * (MULTIPLIER[(m[5] ?? "").toLowerCase()] ?? 1);
  if (!Number.isSafeInteger(cents)) return null;
  return m[1] === "-" ? -cents : cents;
}

/* Every amount in the text, in order: { index, text, symbol, cents }. index is where it starts in the text. */
export function amountMatches(text) {
  const out = [];
  for (const piece of splitUrls(text ?? "")) {
    if (piece.kind !== "text") continue;
    for (const m of piece.text.matchAll(moneyPattern())) {
      const cents = toCents(m);
      if (cents === null) continue;
      out.push({ index: piece.index + m.index, text: m[0], symbol: m[2], cents });
    }
  }
  return out;
}

export const parseAmounts = (text) => amountMatches(text).map(({ symbol, cents }) => ({ symbol, cents }));

/* Amounts of one event. An amount repeated in the title and the notes counts once. */
export function amountsOf(alarm) {
  const fromTitle = parseAmounts(alarm.title);
  const unmatched = [...fromTitle];
  const extra = parseAmounts(alarm.desc).filter((x) => {
    const i = unmatched.findIndex((y) => y.symbol === x.symbol && y.cents === x.cents);
    if (i === -1) return true;
    unmatched.splice(i, 1);
    return false;
  });
  return [...fromTitle, ...extra];
}

/* Map of symbol -> cents across events */
export function sumAmounts(alarms) {
  const totals = new Map();
  for (const a of alarms) {
    for (const { symbol, cents } of amountsOf(a)) totals.set(symbol, (totals.get(symbol) ?? 0) + cents);
  }
  return totals;
}

/* "$1,450 + €20", or "" when there are no amounts */
export const formatTotals = (totals) =>
  [...totals].map(([symbol, cents]) => formatMoney(symbol, cents)).join(" + ");
