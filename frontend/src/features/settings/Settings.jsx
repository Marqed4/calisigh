import { useState, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Close, Upload, Volume } from "../../shared/components/Icons.jsx";
import { backgrounds, holidays as holidaysApi, sounds } from "../../shared/lib/api.js";
import { BACKGROUNDS, saveBackground, savedBgKey } from "../appearance/backgrounds.js";
import { appearance, holidayToggles } from "./settings.js";
import { closeThisWindow } from "../../shared/lib/windows.js";
import { applyFont, listFonts, saveFont, savedFont } from "../appearance/fonts.js";
import PresetsEditor from "../presets/PresetsEditor.jsx";
import HolidayKeyForm from "../holidays/HolidayKeyForm.jsx";
import { applyTrim, saveTrim, savedTrim } from "../appearance/trim.js";
import ThemePicker from "../appearance/ThemePicker.jsx";
import "./Settings.css";

const TABS = [
  { key: "appearance", label: "Appearance" },
  { key: "calendar", label: "Calendar" },
  { key: "sound", label: "Alert sound" },
];

const HINTS = {
  appearance: "Theme changes preview as you click.",
  calendar: "Press Save to keep your changes.",
  sound: "Press Save to keep the chosen sound.",
};

function Toggle({ on, onClick, title }) {
  return (
    <button
      className={`settings-toggle-btn ${on ? "settings-toggle-btn--on" : ""}`}
      aria-pressed={on}
      onClick={onClick}
      title={title}
    >
      {on ? "On" : "Off"}
    </button>
  );
}

export default function Settings() {

  const [selectedBg, setSelectedBg] = useState(savedBgKey);
  const [toggles, setToggles] = useState(holidayToggles.read);
  const flip = (name) => setToggles(t => ({ ...t, [name]: !t[name] }));
  const [font, setFont] = useState(savedFont);
  const [fonts, setFonts] = useState([]);
  const [keyStatus, setKeyStatus] = useState(null);
  const [tab, setTab] = useState("appearance");
  const [trim, setTrim] = useState(savedTrim);

  /* Preview a trim change right away; Cancel puts the saved one back */
  function changeTrim(change) {
    const next = { ...trim, ...change };
    setTrim(next);
    applyTrim(next);
  }
  const [look, setLook] = useState(appearance.read);
  const [customBackgrounds, setCustomBackgrounds] = useState([]);
  /* What happened to the last background added, and pictures that would not load from disk */
  const [bgMessage, setBgMessage] = useState(null);
  const [brokenBgs, setBrokenBgs] = useState([]);
  const [customSounds, setCustomSounds] = useState([]);
  const [selectedSound, setSelectedSound] = useState(null);
  const [volume, setVolume] = useState(100);
  const volumeDebounceRef = useRef(null);
  const selectedSoundRef = useRef(selectedSound);

  useEffect(() => {
    selectedSoundRef.current = selectedSound;
  }, [selectedSound]);

  const CURRENT_BACKGROUND = BACKGROUNDS.find(b => b.value === selectedBg);

  const previewBg = CURRENT_BACKGROUND
    ? CURRENT_BACKGROUND.src
    : customBackgrounds.find(e => e.split("|&")[0] === selectedBg)
        ? convertFileSrc(customBackgrounds.find(e => e.split("|&")[0] === selectedBg).split("|&")[1])
        : BACKGROUNDS[0].src;

  useEffect(() => {
    listFonts().then(setFonts);
    holidaysApi.keyStatus().then(setKeyStatus);
    loadBackgrounds();
    loadSounds();
    loadVolume();
  }, []);

  /* Returns the list, or null when it could not be loaded (the old list stays on screen) */
  async function loadBackgrounds() {
    try {
      const list = await backgrounds.list();
      if (!Array.isArray(list)) throw new Error("The server did not send a list.");
      setCustomBackgrounds(list);
      return list;
    } catch (err) {
      console.error("Failed to load backgrounds:", err);
      setBgMessage({ kind: "error", text: "Could not load your added backgrounds. Is the server running?" });
      return null;
    }
  }

  async function loadSounds() {
    try {
      const [list, selected] = await Promise.all([sounds.list(), sounds.selected()]);
      setCustomSounds(list);
      setSelectedSound(selected || null);
    } catch (err) {
      console.error("Failed to load sounds:", err);
    }
  }

  async function loadVolume() {
    try {
      const data = await sounds.volume();
      setVolume(Math.round((data.volume ?? 1.0) * 100));
    } catch (err) {
      console.error("Failed to load volume:", err);
    }
  }

  async function handleVolumeChange(e) {
    const val = Number(e.target.value);
    setVolume(val);
    clearTimeout(volumeDebounceRef.current);
    volumeDebounceRef.current = setTimeout(async () => {
      try {
        await sounds.setVolume(val / 100);
      } catch (err) {
        console.error("Failed to set volume:", err);
      }
    }, 300);
  }

  async function uploadBackground() {
    setBgMessage(null);
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
      });
      if (!path) return;
      const before = customBackgrounds.length;
      const res = await backgrounds.add(path);
      /* The route hands back the fetch response, so a 4xx or 5xx must not pass as success */
      if (res && res.ok === false) {
        const detail = (await res.text().catch(() => "")).trim().slice(0, 200);
        throw new Error(detail || `The server answered ${res.status}.`);
      }
      await new Promise(r => setTimeout(r, 300));
      const list = await loadBackgrounds();
      if (!list) return;
      const stem = String(path).split(/[\\/]/).pop().replace(/\.[^.]+$/, "").toLowerCase();
      const shown = list.length > before || list.some(entry => entry.toLowerCase().includes(stem));
      setBgMessage(shown
        ? { kind: "note", text: "Added. Pick it, then press Save." }
        : { kind: "error", text: "The server took the file, but it is not in the list. Its name or type may not be supported." });
    } catch (err) {
      console.error("Failed to upload background:", err);
      setBgMessage({ kind: "error", text: `Could not add that picture. ${err.message ?? ""}`.trim() });
    }
  }

  async function removeBackground(entry) {
    const name = entry.split("|&")[0];
    if (selectedBg === name) setSelectedBg("fall");
    setBrokenBgs(prev => prev.filter(n => n !== name));
    try {
      await backgrounds.remove(name);
      await loadBackgrounds();
    } catch (err) {
      console.error("Failed to remove background:", err);
    }
  }

  async function uploadSound() {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "Audio", extensions: ["mp3", "wav"] }],
      });
      if (!path) return;
      await sounds.add(path);
      await new Promise(r => setTimeout(r, 300));
      await loadSounds();
    } catch (err) {
      console.error("Failed to upload sound:", err);
    }
  }

  async function removeSound(entry) {
    const name = entry.split("|&")[0];
    if (selectedSound === name) setSelectedSound(null);
    try {
      await sounds.remove(name);
      await loadSounds();
    } catch (err) {
      console.error("Failed to remove sound:", err);
    }
  }

  async function stopSound() {
    try {
      await sounds.stop();
    } catch (err) {
      console.error("Failed to stop sound:", err);
    }
  }

  async function previewSound(name) {
    try {
      await sounds.play(name);
    } catch (err) {
      console.error("Failed to preview sound:", err);
    }
  }

  async function save() {
    saveBackground(selectedBg, customBackgrounds);
    holidayToggles.write(toggles);
    appearance.write(look);
    saveFont(font);
    saveTrim(trim);
    try {
      await sounds.select(selectedSound ?? "");
      await stopSound();
    } catch (_) {}
    await closeThisWindow();
  }

  async function handleCancel() {
    applyFont();
    applyTrim();
    await stopSound();
    await closeThisWindow();
  }

  const flipLook = (name) => setLook(l => ({ ...l, [name]: !l[name] }));

  return (
    <>
      <div
        className="settings-background"
        style={{ backgroundImage: `url(${previewBg})` }}
      />
      <div className="settings-root">
        <div className="settings-shell">

          <nav className="settings-nav" aria-label="Settings sections">
            <h2 className="settings-title">Settings</h2>
            {TABS.map(t => (
              <button
                key={t.key}
                className={`settings-nav-item${tab === t.key ? " settings-nav-item--active" : ""}`}
                aria-current={tab === t.key ? "page" : undefined}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="settings-main">
            <div className="settings-main-body">

              {tab === "appearance" && (
                <>
                  <h3 className="settings-section-label">Theme</h3>
                  <ThemePicker
                    trim={trim}
                    onChange={changeTrim}
                    extra={
                      <>
                        <div className="theme-opt">
                          <span className="theme-row-label">Blur</span>
                          <Toggle
                            on={look.cellBlur}
                            onClick={() => flipLook("cellBlur")}
                            title="Frosted glass effect behind the calendar cells and panels"
                          />
                        </div>
                        <div className="theme-opt">
                          <span className="theme-row-label">Sharp cells</span>
                          <Toggle
                            on={look.sharpCells}
                            onClick={() => flipLook("sharpCells")}
                            title="Square corners and crisp borders instead of rounded ones"
                          />
                        </div>
                        <div className="theme-opt">
                          <span className="theme-row-label">Font</span>
                          <input
                            className="input"
                            list="settings-font-list"
                            placeholder="Default"
                            aria-label="Font"
                            value={font}
                            onChange={e => {
                              setFont(e.target.value);
                              if (e.target.value === "" || fonts.includes(e.target.value)) applyFont(e.target.value);
                            }}
                          />
                          <datalist id="settings-font-list">
                            {fonts.map(f => <option key={f} value={f} />)}
                          </datalist>
                          {font && <button className="settings-font-reset" onClick={() => { setFont(""); applyFont(""); }}>Default</button>}
                        </div>
                      </>
                    }
                  />

                  <div className="settings-section-head">
                    <h3 className="settings-section-label">Background</h3>
                    <div className="settings-section-side">
                      <span className="settings-section-note">{BACKGROUNDS.length} built in, plus your own</span>
                      <button className="btn" onClick={uploadBackground}>Add picture</button>
                    </div>
                  </div>

                  <div className="settings-bg-picker">
                    {BACKGROUNDS.map(bg => (
                      <div
                        key={bg.value}
                        className={`settings-bg-card ${selectedBg === bg.value ? "settings-bg-card--selected" : ""}`}
                        onClick={() => setSelectedBg(bg.value)}
                      >
                        <img src={bg.src} alt={bg.label} className="settings-bg-img" />
                        <span className="settings-bg-label">{bg.label}</span>
                      </div>
                    ))}

                    {customBackgrounds.map((entry, i) => {
                      const name = entry.split("|&")[0];
                      const path = entry.split("|&")[1];
                      return (
                        <div
                          key={entry}
                          className={`settings-bg-card ${selectedBg === name ? "settings-bg-card--selected" : ""}`}
                          onClick={() => setSelectedBg(name)}
                        >
                          <img
                            src={convertFileSrc(path)}
                            alt={name}
                            className="settings-bg-img"
                            onError={() => setBrokenBgs(prev => (prev.includes(name) ? prev : [...prev, name]))}
                          />
                          <span className="settings-bg-label">{name}</span>
                          <button
                            className="settings-remove settings-bg-remove"
                            aria-label={`Remove ${name}`}
                            title="Remove"
                            onClick={(e) => { e.stopPropagation(); removeBackground(entry); }}
                          >
                            <Close size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {tab === "calendar" && (
                <>
                  <h3 className="settings-section-label">Holidays</h3>

                  <div className="settings-toggle-row">
                    <span className="settings-toggle-label">Federal Holidays</span>
                    <Toggle
                      on={toggles.federal}
                      onClick={() => flip('federal')}
                      title="Show or hide US federal holidays"
                    />
                  </div>

                  <div className="settings-toggle-row">
                    <span className="settings-toggle-label">Observances</span>
                    <Toggle
                      on={toggles.observance}
                      onClick={() => flip('observance')}
                      title="Show or hide cultural observances like Earth Day, Halloween, etc."
                    />
                  </div>

                  <div className="settings-toggle-row">
                    <span className="settings-toggle-label">Religious Observances</span>
                    <Toggle
                      on={toggles.religious}
                      onClick={() => flip('religious')}
                      title="Show or hide religious observances like Easter, Good Friday, Hanukkah, etc."
                    />
                  </div>

                  <div className="settings-holiday-key">
                    <span className="settings-toggle-label">
                      Holiday key {keyStatus && (keyStatus.set ? "(set)" : "(not set, holidays are off)")}
                    </span>
                    <HolidayKeyForm country={keyStatus?.country} onSaved={() => holidaysApi.keyStatus().then(setKeyStatus)} />
                  </div>

                  <h3 className="settings-section-label">Week</h3>

                  <div className="settings-toggle-row">
                    <span className="settings-toggle-label">Week starts on Monday</span>
                    <Toggle
                      on={look.mondayStart}
                      onClick={() => flipLook("mondayStart")}
                      title="Show Monday as the first day of the week in the month, week and mini calendars"
                    />
                  </div>

                  <PresetsEditor />
                </>
              )}

              {tab === "sound" && (
                <>
                  <div className="settings-section-head">
                    <h3 className="settings-section-label">Alert sound</h3>
                    <button className="btn" onClick={uploadSound}>
                      <Upload size={14} />&nbsp;Add sound
                    </button>
                  </div>

                  <div className="settings-volume-row">
                    <span className="settings-volume-icon"><Volume size={16} /></span>
                    <div className="settings-volume-slider-wrap">
                      <input
                        className="settings-volume-slider"
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        aria-label="Volume"
                        onChange={handleVolumeChange}
                        style={{
                          background: `linear-gradient(to right,
                          rgba(255,255,255,0.85) ${volume}%,
                          rgba(255,255,255,0.2) ${volume}%)`
                        }}
                      />
                    </div>
                    <span className="settings-volume-value">{volume}%</span>
                  </div>

                  <div className="settings-sounds-list">
                    <div
                      className={`settings-sound-card ${selectedSound === null ? "settings-sound-card-selected" : ""}`}
                      onClick={() => {
                        if (selectedSound === null) {
                          stopSound();
                        } else {
                          setSelectedSound(null);
                          previewSound("chime");
                        }
                      }}
                    >
                      <span>Default Chime</span>
                    </div>

                    {customSounds.map((entry, i) => {
                      const name = entry.split("|&")[0];
                      return (
                        <div
                          key={i}
                          title={name}
                          className={`settings-sound-card ${selectedSound === name ? "settings-sound-card-selected" : ""}`}
                          onClick={() => {
                            if (selectedSound === name) {
                              stopSound();
                            } else {
                              setSelectedSound(name);
                              previewSound(name);
                            }
                          }}
                        >
                          <span>{name}</span>
                          <button
                            className="settings-remove"
                            aria-label={`Remove ${name}`}
                            title="Remove"
                            onClick={(e) => { e.stopPropagation(); removeSound(entry); }}
                          >
                            <Close size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {tab === "appearance" && (bgMessage || brokenBgs.length > 0) && (
              <div className="settings-bg-message">
                {bgMessage && (
                  <p
                    className={bgMessage.kind === "error" ? "form-error" : "settings-bg-note"}
                    role={bgMessage.kind === "error" ? "alert" : "status"}
                  >
                    {bgMessage.text}
                  </p>
                )}
                {brokenBgs.length > 0 && (
                  <p className="form-error" role="alert">
                    Could not load the picture for {brokenBgs.join(", ")}. If the file is there, the app may not be
                    allowed to read its folder (the asset protocol scope in tauri.conf.json).
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="settings-actions">
          <span className="settings-hint">{HINTS[tab]}</span>
          <div className="settings-actions-buttons">
            <button className="btn" onClick={handleCancel}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </>
  );
}
