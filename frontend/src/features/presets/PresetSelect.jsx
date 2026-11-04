import { useEffect, useState } from "react";
import { marks } from "../../shared/lib/api.js";
import "./PresetSelect.css";

/* Loads the saved presets for the add and edit windows */
export function usePresets() {
  const [presets, setPresets] = useState([]);
  useEffect(() => { marks.get().then(data => setPresets(data.presets)); }, []);
  return presets;
}

/*
Presets as a row of buttons in their own colours, so they are easy to see and one click picks one.
Click the picked one again to clear it. onChange gets the id and the preset itself so the window can fill in its defaults.
*/
export default function PresetSelect({ presets, value, onChange }) {
  if (presets.length === 0) return null;

  return (
    <div className="preset-pick" role="group" aria-label="Event preset">
      <span className="preset-pick-label">Preset</span>
      <div className="preset-pick-row">
        {presets.map(p => {
          const on = p.id === value;
          return (
            <button
              key={p.id}
              type="button"
              className={`preset-pick-btn${on ? " preset-pick-on" : ""}`}
              style={{ "--preset-color": p.color || "var(--accent)" }}
              aria-pressed={on}
              title={on ? "Click to clear this preset" : "Fill in the title, text and time from this preset"}
              onClick={() => (on ? onChange("", null) : onChange(p.id, p))}
            >
              {p.name || "Untitled preset"}
            </button>
          );
        })}
      </div>
    </div>
  );
}