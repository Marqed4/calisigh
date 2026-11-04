import { ACCENTS, FINISHES, SWATCHES, THEMES } from "./trim.js";
import "./ThemePicker.css";

const same = (a, b) => a?.toLowerCase() === b.toLowerCase();

/* Finish, trim colour and accent colour, plus ready-made combinations. onChange gets the changed fields. */
export default function ThemePicker({ trim, onChange }) {
  const matching = trim.accent === "match";
  const accent = matching ? trim.color : trim.accent;

  return (
    <div className="settings-trim theme-picker">
      <span className="settings-toggle-label">Theme</span>
      <div className="theme-presets">
        {THEMES.map(t => (
          <button
            key={t.label}
            className="btn theme-preset"
            onClick={() => onChange({ finish: t.finish, color: t.color, accent: t.accent })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <span className="settings-toggle-label">Finish</span>
      <div className="segmented" role="tablist" aria-label="Finish">
        {FINISHES.map(f => (
          <button
            key={f.key}
            role="tab"
            aria-selected={trim.finish === f.key}
            className={`segmented-btn${trim.finish === f.key ? " segmented-active" : ""}`}
            onClick={() => onChange({ finish: f.key })}
          >
            {f.label}
          </button>
        ))}
      </div>

      <span className="settings-toggle-label">Trim colour</span>
      <div className="settings-swatches">
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
          onChange={e => onChange({ color: e.target.value })}
        />
      </div>

      <span className="settings-toggle-label">Accent colour</span>
      <div className="settings-swatches">
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
          onChange={e => onChange({ accent: e.target.value })}
        />
        <button
          className="btn theme-match"
          aria-pressed={matching}
          title="Use the trim colour as the accent too"
          onClick={() => onChange({ accent: matching ? accent : "match" })}
        >
          Match trim
        </button>
      </div>

      <span className="settings-toggle-label">Glow</span>
      <div className="settings-swatches">
        <button
          className={`settings-toggle-btn ${trim.glow !== false ? "settings-toggle-btn--on" : ""}`}
          aria-pressed={trim.glow !== false}
          title="A soft accent-coloured halo on today and on event chips"
          onClick={() => onChange({ glow: trim.glow === false })}
        >
          {trim.glow !== false ? "On" : "Off"}
        </button>
      </div>
    </div>
  );
}