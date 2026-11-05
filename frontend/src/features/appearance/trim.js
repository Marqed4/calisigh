import "./trim-glow.css";
/*
The theme is three picks (a finish, a trim colour and an accent colour) plus a glow switch.
The trim is the thin line work of the interface: borders, the scrollbar line and the edge
shading on cells and buttons. The accent is the highlight colour (today, primary buttons,
active switches). The glow is a soft accent-coloured halo on today and on event chips (trim-glow.css). App.css turns the finish (data-trim), trim colour (--trim) and accent
(--accent) into the actual look.
*/
const FINISH_KEY = "calisigh-trim-finish";
const COLOR_KEY = "calisigh-trim-color";
const ACCENT_KEY = "calisigh-accent";
const GLOW_KEY = "calisigh-glow";

export const FINISHES = [
  { key: "matte", label: "Matte" },
  { key: "metallic", label: "Metallic" },
  { key: "plastic", label: "Plastic" },
  { key: "stone", label: "Stone" },
  { key: "stainless", label: "Stainless" },
  { key: "shimmer", label: "Shimmer" },
  { key: "sparkle", label: "Sparkle" },
  { key: "transparent", label: "Glass" },
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

export const ACCENTS = [
  { color: "#8ab4ff", label: "Sky" },
  { color: "#b794f6", label: "Violet" },
  { color: "#f48fb1", label: "Rose" },
  { color: "#ff8a65", label: "Coral" },
  { color: "#ffc857", label: "Amber" },
  { color: "#a3e635", label: "Lime" },
  { color: "#5eead4", label: "Mint" },
  { color: "#e0525e", label: "Crimson" },
  { color: "#e6e8ee", label: "Silver" },
];

/* Ready-made combinations of finish, trim colour and accent */
export const THEMES = [
  { label: "Classic blue", finish: "matte", color: "#9aa0b4", accent: "#8ab4ff" },
  { label: "Steel glass", finish: "transparent", color: "#9aa0b4", accent: "#8ab4ff" },
  { label: "Gold shimmer", finish: "shimmer", color: "#d4af37", accent: "#ffc857" },
  { label: "Rose sparkle", finish: "sparkle", color: "#f48fb1", accent: "#f48fb1" },
  { label: "Stainless", finish: "stainless", color: "#b8bcc6", accent: "#e6e8ee" },
  { label: "Copper stone", finish: "stone", color: "#b87333", accent: "#ff8a65" },
  { label: "Emerald plastic", finish: "plastic", color: "#4caf7d", accent: "#5eead4" },
  { label: "Midnight onyx", finish: "matte", color: "#2b2d3a", accent: "#7c83ff" },
  { label: "Violet glass", finish: "transparent", color: "#8e7cc3", accent: "#c4b5fd" },
  { label: "Ocean pearl", finish: "stainless", color: "#7fb3d5", accent: "#38bdf8" },
  { label: "Sunset shimmer", finish: "shimmer", color: "#e0703f", accent: "#fbbf24" },
  { label: "Mint sparkle", finish: "sparkle", color: "#7fd8b5", accent: "#34d399" },
  { label: "Titanium", finish: "stainless", color: "#8d939f", accent: "#cbd5e1" },
  { label: "Slate stone", finish: "stone", color: "#5f6b7a", accent: "#94a3b8" },
  { label: "Marble white", finish: "stone", color: "#e8e6e1", accent: "#a8a29e" },
  { label: "Crimson plastic", finish: "plastic", color: "#d64550", accent: "#fb7185" },
  { label: "Sunny plastic", finish: "plastic", color: "#f2c230", accent: "#fde047" },
  { label: "Rose gold", finish: "stainless", color: "#d9a28f", accent: "#fda4af" },
  { label: "Obsidian glass", finish: "transparent", color: "#1f2330", accent: "#22d3ee" },
  { label: "Lavender matte", finish: "matte", color: "#b7a6d9", accent: "#a78bfa" },
  { label: "Forest stone", finish: "stone", color: "#4a6b55", accent: "#86efac" },
];

/* accent is a hex colour, or "match" to follow the trim colour; glow is on unless it is false */
export const DEFAULT_TRIM = { finish: "matte", color: SWATCHES[0].color, accent: ACCENTS[0].color, glow: true };

const isHex = (value) => /^#[0-9a-f]{6}$/i.test(value ?? "");

export function savedTrim() {
  const finish = localStorage.getItem(FINISH_KEY);
  const color = localStorage.getItem(COLOR_KEY);
  const accent = localStorage.getItem(ACCENT_KEY);
  return {
    finish: FINISHES.some(f => f.key === finish) ? finish : DEFAULT_TRIM.finish,
    color: isHex(color) ? color : DEFAULT_TRIM.color,
    accent: accent === "match" || isHex(accent) ? accent : DEFAULT_TRIM.accent,
    glow: localStorage.getItem(GLOW_KEY) !== "false",
  };
}

export function saveTrim({ finish, color, accent, glow }) {
  localStorage.setItem(FINISH_KEY, finish);
  localStorage.setItem(COLOR_KEY, color);
  localStorage.setItem(ACCENT_KEY, accent);
  if (glow !== undefined) localStorage.setItem(GLOW_KEY, String(glow !== false));
}

/* Dark text on light accents, white text on dark ones, so "today" and primary buttons stay readable */
export function onAccent(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? "#0c1220" : "#ffffff";
}

export function applyTrim(trim = savedTrim()) {
  const accent = trim.accent === "match" ? trim.color : trim.accent;
  const root = document.documentElement;
  root.dataset.trim = trim.finish;
  root.dataset.glow = trim.glow === false ? "off" : "on";
  root.style.setProperty("--trim", trim.color);
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--on-accent", onAccent(accent));
}

/* Applies the saved theme now and again whenever another window changes it */
export function keepTrimApplied() {
  applyTrim();
  const keys = [FINISH_KEY, COLOR_KEY, ACCENT_KEY, GLOW_KEY];
  const onStorage = (e) => { if (keys.includes(e.key)) applyTrim(); };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}