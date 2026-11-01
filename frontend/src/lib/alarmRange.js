/* Date range the chat may see, in localStorage so the chat window can read it. "" = open end. */
const KEY = "calisigh-ai-range";

export function readRange() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { from: saved.from ?? "", to: saved.to ?? "" };
  } catch (_) {
    return { from: "", to: "" };
  }
}

export function writeRange(range) {
  localStorage.setItem(KEY, JSON.stringify(range));
}

export function isRangeSet(range) {
  return Boolean(range.from || range.to);
}

export function rangeQuery(range) {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const q = params.toString();
  return q ? `?${q}` : "";
}

export function rangeLabel(range) {
  const fmt = iso => new Date(`${iso}T00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  if (range.from && range.to) return `${fmt(range.from)} to ${fmt(range.to)}`;
  if (range.from) return `From ${fmt(range.from)}`;
  if (range.to) return `Up to ${fmt(range.to)}`;
  return "All alarms";
}
