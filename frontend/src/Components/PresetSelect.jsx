import { useEffect, useState } from "react";
import { marks } from "../lib/api.js";

/* Loads the saved presets for the add and edit windows */
export function usePresets() {
  const [presets, setPresets] = useState([]);
  useEffect(() => { marks.get().then(data => setPresets(data.presets)); }, []);
  return presets;
}

/* Picks a preset by id; onChange also gets the preset itself so the window can fill in its defaults */
export default function PresetSelect({ presets, value, onChange }) {
  if (presets.length === 0) return null;

  return (
    <select
      className="input"
      value={value}
      aria-label="Event preset"
      onChange={(e) => onChange(e.target.value, presets.find(p => p.id === e.target.value) ?? null)}
    >
      <option value="">No preset</option>
      {presets.map(p => <option key={p.id} value={p.id}>{p.name || "Untitled preset"}</option>)}
    </select>
  );
}
