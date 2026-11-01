/*
The trim is the thin line work of the interface: borders, the scrollbar line and the edge
shading on cells and buttons. The user picks a colour and a finish; App.css turns the
finish (data-trim) and colour (--trim) into the actual look.
*/
const FINISH_KEY = "calisigh-trim-finish";
const COLOR_KEY = "calisigh-trim-color";

export const FINISHES = [
  { key: "matte", label: "Matte" },
  { key: "metallic", label: "Metallic" },
  { key: "plastic", label: "Plastic" },
  { key: "stone", label: "Stone" },
];

export const SWATCHES = [
  { color: "#9aa0b4", label: "Steel" },
  { color: "#d4af37", label: "Gold" },
  { color: "#b87333", label: "Copper" },
  { color: "#e0525e", label: "Red" },
  { color: "#5a8dee", label: "Blue" },
  { color: "#4caf7d", label: "Green" },
  { color: "#d9d2c0", label: "Bone" },
];

export const DEFAULT_TRIM = { finish: "matte", color: SWATCHES[0].color };

export function savedTrim() {
  const finish = localStorage.getItem(FINISH_KEY);
  const color = localStorage.getItem(COLOR_KEY);
  return {
    finish: FINISHES.some(f => f.key === finish) ? finish : DEFAULT_TRIM.finish,
    color: /^#[0-9a-f]{6}$/i.test(color ?? "") ? color : DEFAULT_TRIM.color,
  };
}

export function saveTrim({ finish, color }) {
  localStorage.setItem(FINISH_KEY, finish);
  localStorage.setItem(COLOR_KEY, color);
}

export function applyTrim(trim = savedTrim()) {
  document.documentElement.dataset.trim = trim.finish;
  document.documentElement.style.setProperty("--trim", trim.color);
}

/* Applies the saved trim now and again whenever another window changes it */
export function keepTrimApplied() {
  applyTrim();
  const onStorage = (e) => { if (e.key === FINISH_KEY || e.key === COLOR_KEY) applyTrim(); };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
