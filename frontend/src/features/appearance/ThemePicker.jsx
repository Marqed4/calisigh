import { useState } from "react";
import { ACCENTS, FINISHES, SWATCHES, THEMES } from "./trim.js";
import "./ThemePicker.css";

const same = (a, b) => a?.toLowerCase() === b.toLowerCase();
const SHOWN = 5;

/*
The Theme panel: ready-made combinations, finish, trim and accent colours, glow, depth.
onChange gets the changed fields. `extra` is more options for the last row (Settings puts
blur, sharp cells and font there). Wrap each one in <div className="theme-opt">.
*/
export default function ThemePicker({ trim, onChange, extra }) {
  const [more, setMore] = useState(false);
  const matching = trim.accent === "match";
  const accent = matching ? trim.color : trim.accent;
  const isCurrent = (t) => trim.finish === t.finish && same(trim.color, t.color) && same(trim.accent, t.accent);
  const themes = more ? THEMES : THEMES.slice(0, SHOWN);

  return (
    <div className="theme-panel">
      <div className="theme-row">
        <span className="theme-row-label">Ready-made</span>
        {themes.map(t => (
          <button
            key={t.label}
            className={`btn theme-chip${isCurrent(t) ? " theme-chip--active" : ""}`}
            aria-pressed={isCurrent(t)}
            onClick={() => onChange({ finish: t.finish, color: t.color, accent: t.accent })}
          >
            {t.label}
          </button>
        ))}
        <button className="btn theme-chip" aria-expanded={more} onClick={() => setMore(m => !m)}>
          {more ? "Fewer" : "More..."}
        </button>
      </div>

      <div className="theme-row" role="radiogroup" aria-label="Finish">
        <span className="theme-row-label">Finish</span>
        {FINISHES.map(f => (
          <button
            key={f.key}
            role="radio"
            aria-checked={trim.finish === f.key}
            className={`btn theme-chip${trim.finish === f.key ? " theme-chip--active" : ""}`}
            onClick={() => onChange({ finish: f.key })}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="theme-row theme-row--split">
        <div className="theme-group">
          <span className="theme-row-label">Trim</span>
          {SWATCHES.map(sw => (
            <button
              key={sw.color}
              className={`settings-swatch${same(trim.color, sw.color) ? " settings-swatch-active" : ""}`}
              style={{ background: sw.color }}
              title={sw.label}
              aria-label={`Trim ${sw.label}`}
              onClick={() => onChange({ color: sw.color })}
            />
          ))}
          <input
            className="settings-color"
            type="color"
            value={trim.color}
            title="Pick any trim colour"
            aria-label="Custom trim colour"
            onChange={e => onChange({ color: e.target.value })}
          />
        </div>

        <div className="theme-group">
          <span className="theme-row-label">Accent</span>
          {ACCENTS.map(sw => (
            <button
              key={sw.color}
              className={`settings-swatch${!matching && same(trim.accent, sw.color) ? " settings-swatch-active" : ""}`}
              style={{ background: sw.color }}
              title={sw.label}
              aria-label={`Accent ${sw.label}`}
              onClick={() => onChange({ accent: sw.color })}
            />
          ))}
          <input
            className="settings-color"
            type="color"
            value={accent}
            title="Pick any accent colour"
            aria-label="Custom accent colour"
            onChange={e => onChange({ accent: e.target.value })}
          />
          <button
            className="btn theme-chip theme-match"
            aria-pressed={matching}
            title="Use the trim colour as the accent too"
            onClick={() => onChange({ accent: matching ? accent : "match" })}
          >
            Match trim
          </button>
        </div>
      </div>

      <div className="theme-row theme-row--split">
        <div className="theme-opt">
          <span className="theme-row-label">Glow</span>
          <button
            className={`settings-toggle-btn ${trim.glow !== false ? "settings-toggle-btn--on" : ""}`}
            aria-pressed={trim.glow !== false}
            title="A soft accent-coloured halo on today and on event chips"
            onClick={() => onChange({ glow: trim.glow === false })}
          >
            {trim.glow !== false ? "On" : "Off"}
          </button>
        </div>
        <div className="theme-opt">
          <span className="theme-row-label">Depth</span>
          <button
            className={`settings-toggle-btn ${trim.depth === true ? "settings-toggle-btn--on" : ""}`}
            aria-pressed={trim.depth === true}
            title="Buttons, cells and chips stand up, lift when hovered and press in when clicked"
            onClick={() => onChange({ depth: trim.depth !== true })}
          >
            {trim.depth === true ? "On" : "Off"}
          </button>
        </div>
        {extra}
      </div>
    </div>
  );
}
