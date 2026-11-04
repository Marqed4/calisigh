import { useEffect, useRef, useState } from "react";
import { Close, Plus } from "../../shared/components/Icons.jsx";
import { marks } from "../../shared/lib/api.js";
import { listFonts } from "../appearance/fonts.js";
import { PRESET_COLORS, newPreset } from "./presets.js";
import { notifyAlarmsChanged } from "../../shared/lib/windows.js";
import "./PresetsEditor.css";

const SAVE_DELAY_MS = 500;

/* Settings section: each preset is the default colour, font, title, text and time for a kind of event */
export default function PresetsEditor() {
  const [presets, setPresets] = useState([]);
  const [fonts, setFonts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    marks.get().then(data => { setPresets(data.presets); setLoaded(true); });
    listFonts().then(setFonts);
    return () => clearTimeout(saveTimer.current);
  }, []);

  /* Saves a moment after the last change, then tells the main window to restyle its events */
  function change(next) {
    setPresets(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await marks.savePresets(next);
      notifyAlarmsChanged();
    }, SAVE_DELAY_MS);
  }

  const edit = (id, patch) => change(presets.map(p => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <div className="presets">
      <span className="settings-toggle-label">Event presets</span>
      <p className="presets-hint">
        A preset is the default colour, font, title, text and time for a kind of event. Pick one when you add or edit an event and it fills those in.
      </p>

      {loaded && presets.length === 0 && <p className="presets-hint">No presets yet.</p>}

      {presets.map(p => (
        <div key={p.id} className="preset-card" style={{ borderLeftColor: p.color }}>
          <div className="preset-row">
            <input
              className="input"
              placeholder="Preset name (Class, Gig, Birthday...)"
              value={p.name}
              onChange={(e) => edit(p.id, { name: e.target.value })}
            />
            <button className="preset-remove" aria-label={`Delete ${p.name || "preset"}`} title="Delete preset"
              onClick={() => change(presets.filter(x => x.id !== p.id))}>
              <Close size={14} />
            </button>
          </div>

          <div className="preset-swatches">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                className={`preset-swatch${p.color === color ? " preset-swatch-on" : ""}`}
                style={{ background: color }}
                aria-label={`Colour ${color}`}
                onClick={() => edit(p.id, { color })}
              />
            ))}
            <input
              type="color"
              className="preset-color"
              value={p.color || PRESET_COLORS[0]}
              aria-label="Custom colour"
              onChange={(e) => edit(p.id, { color: e.target.value })}
            />
          </div>

          <input
            className="input"
            placeholder="Font (blank = app font)"
            list="preset-font-list"
            value={p.font}
            onChange={(e) => edit(p.id, { font: e.target.value })}
          />
          <input
            className="input"
            placeholder="Default title"
            value={p.title}
            onChange={(e) => edit(p.id, { title: e.target.value })}
          />
          <input
            className="input"
            type="time"
            title="Default time (leave blank for none)"
            aria-label="Default time"
            value={p.time ?? ""}
            onChange={(e) => edit(p.id, { time: e.target.value })}
          />
          <textarea
            className="input preset-text"
            placeholder="Default text (links like https://example.com are clickable)"
            value={p.desc}
            onChange={(e) => edit(p.id, { desc: e.target.value })}
          />
        </div>
      ))}

      <datalist id="preset-font-list">
        {fonts.map(f => <option key={f} value={f} />)}
      </datalist>

      <button className="btn" onClick={() => change([...presets, newPreset()])}>
        <Plus size={14} />&nbsp;Add preset
      </button>
    </div>
  );
}