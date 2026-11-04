/*
Currency amounts written in event text: a currency symbol, then a number ("$50", "$1,250.50", "€20", "$5k").
One place knows the pattern, so the highlighting, the search total and the chat assistant agree.
Sums use whole cents so 0.1 + 0.2 never drifts.
*/
const SYMBOLS = "$€£¥₹₩₽₺₪฿₫";
const SOURCE = `([${SYMBOLS}])\\s?(\\d{1,3}(?:,\\d{3})+|\\d+)(\\.\\d{1,2})?([kKmM])?\\b`;
const MULTIPLIER = { k: 1e3, m: 1e6 };

/* A fresh regex each call, because a global regex remembers where it stopped */
export const moneyPattern = () => new RegExp(SOURCE, "g");

export function formatMoney(symbol, cents) {
  const whole = cents % 100 === 0;
  const text = (cents / 100).toLocaleString("en-US", whole
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${text}`;
}

export function parseAmounts(text) {
  const out = [];
  for (const m of (text ?? "").matchAll(moneyPattern())) {
    const base = Math.round(parseFloat(m[2].replace(/,/g, "") + (m[3] ?? "")) * 100);
    const cents = base * (MULTIPLIER[(m[4] ?? "").toLowerCase()] ?? 1);
    out.push({ symbol: m[1], cents });
  }
  return out;
}

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
