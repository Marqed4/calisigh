/*
A preset is the default look and text for a kind of event ("Class", "Gig", "Birthday"):
a colour, a font and a starting title, description and time ("HH:MM", or "" for none). An event stores only the preset's id,
so editing a preset restyles every event that uses it.
*/
import { marks } from "../../shared/lib/api.js";

export const PRESET_COLORS = ["#8ab4ff", "#e0525e", "#4caf7d", "#d4af37", "#b87333", "#b48ead", "#5fb3b3", "#9aa0b4"];

export function newPreset() {
  return { id: `p${Date.now().toString(36)}`, name: "", color: PRESET_COLORS[0], font: "", title: "", desc: "", time: "" };
}

export const findPreset = (presets, id) => presets.find(p => p.id === id) ?? null;

/* Inline style for a chip: its colour (see .chip in CalendarGrid.css) and font */
export function presetStyle(preset) {
  if (!preset) return undefined;
  const style = {};
  if (preset.color) {
    style["--chip-color"] = preset.color;
    style["--chip-bg"] = `color-mix(in srgb, ${preset.color} 24%, transparent)`;
    style["--chip-bg-hover"] = `color-mix(in srgb, ${preset.color} 38%, transparent)`;
  }
  if (preset.font) style.fontFamily = `"${preset.font.replace(/"/g, "")}", var(--font-ui)`;
  return style;
}

/* Two starter presets, added once on first launch. They are ordinary presets: remove them in Settings. */
export const DEFAULT_PRESETS = [
  { id: "default-bill", name: "Bill Due", color: "#e0525e", font: "", title: "Bill due", desc: "" },
  { id: "default-class", name: "Class", color: "#8ab4ff", font: "", title: "Class", desc: "" },
];

const SEEDED_KEY = "calisigh-presets-seeded";

/*
Runs once per install. Only seeds when there are no presets yet, so an existing user keeps
theirs, and a user who deletes the defaults does not get them back (the flag stays set).
*/
export async function seedDefaultPresets() {
  try {
    if (localStorage.getItem(SEEDED_KEY)) return;
    const { presets } = await marks.get();
    if (presets.length === 0) await marks.savePresets(DEFAULT_PRESETS);
    localStorage.setItem(SEEDED_KEY, "1");
  } catch (_) {}
}