/*
A preset is the default look and text for a kind of event ("Class", "Gig", "Birthday"):
a colour, a font and a starting title and description. An event stores only the preset's id,
so editing a preset restyles every event that uses it.
*/
export const PRESET_COLORS = ["#8ab4ff", "#e0525e", "#4caf7d", "#d4af37", "#b87333", "#b48ead", "#5fb3b3", "#9aa0b4"];

export function newPreset() {
  return { id: `p${Date.now().toString(36)}`, name: "", color: PRESET_COLORS[0], font: "", title: "", desc: "" };
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
