import { useState, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { DefaultBackgrounds } from "../resources/assets/images/Backgrounds/index.js";
import { Close, Upload, Volume } from "./Icons.jsx";
import { backgrounds, holidays as holidaysApi, sounds } from "../lib/api.js";
import { saveBackground, savedBgKey } from "../lib/backgrounds.js";
import { appearance, holidayToggles } from "../lib/settings.js";
import { closeThisWindow } from "../lib/windows.js";
import { applyFont, listFonts, saveFont, savedFont } from "../lib/fonts.js";
import PresetsEditor from "./PresetsEditor.jsx";
import HolidayKeyForm from "./HolidayKeyForm.jsx";
import { applyTrim, saveTrim, savedTrim } from "../lib/trim.js";
import ThemePicker from "./ThemePicker.jsx";
import "./Settings.css";

const BG_MAP = [
  { label: "Barn",   value: "barn",     src: DefaultBackgrounds.Barn },
  { label: "Lake",   value: "lakeside", src: DefaultBackgrounds.Lake },
  { label: "Peace",  value: "peace",    src: DefaultBackgrounds.Peace },
  { label: "Silos",  value: "silos",    src: DefaultBackgrounds.Silo },
  { label: "Summer", value: "summer",   src: DefaultBackgrounds.Summer },
  { label: "Tree",   value: "tree",     src: DefaultBackgrounds.Tree },
  { label: "Fall",   value: "fall",     src: DefaultBackgrounds.Fall },
  { label: "Winter", value: "winter",   src: DefaultBackgrounds.Winter },
  { label: "Sandstone",   value: "sandstone",   src: DefaultBackgrounds.Sandstone },
  { label: "PaleStone",   value: "palestone",   src: DefaultBackgrounds.PaleStone },
  { label: "PlasterWall", value: "plasterwall", src: DefaultBackgrounds.PlasterWall },
];

export default function Settings() {

  const [selectedBg, setSelectedBg] = useState(savedBgKey);
  const [toggles, setToggles] = useState(holidayToggles.read);
  const flip = (name) => setToggles(t => ({ ...t, [name]: !t[name] }));
  const [font, setFont] = useState(savedFont);
  const [fonts, setFonts] = useState([]);
  const [keyStatus, setKeyStatus] = useState(null);
  const [trim, setTrim] = useState(savedTrim);

  /* Preview a trim change right away; Cancel puts the saved one back */
  function changeTrim(change) {
    const next = { ...trim, ...change };
    setTrim(next);
    applyTrim(next);
  }
  const [look, setLook] = useState(appearance.read);
  const [customBackgrounds, setCustomBackgrounds] = useState([]);
  const [customSounds, setCustomSounds] = useState([]);
  const [selectedSound, setSelectedSound] = useState(null);
  const [volume, setVolume] = useState(100);
  const volumeDebounceRef = useRef(null);
  const selectedSoundRef = useRef(selectedSound);

  useEffect(() => {
    selectedSoundRef.current = selectedSound;
  }, [selectedSound]);

  const CURRENT_BACKGROUND = BG_MAP.find(b => b.value === selectedBg);

  const previewBg = CURRENT_BACKGROUND
    ? CURRENT_BACKGROUND.src
    : customBackgrounds.find(e => e.split("|&")[0] === selectedBg)
        ? convertFileSrc(customBackgrounds.find(e => e.split("|&")[0] === selectedBg).split("|&")[1])
        : BG_MAP[0].src;

  useEffect(() => {
    listFonts().then(setFonts);
    holidaysApi.keyStatus().then(setKeyStatus);
    loadBackgrounds();
    loadSounds();
    loadVolume();
  }, []);

  async function loadBackgrounds() {
    try {
      setCustomBackgrounds(await backgrounds.list());
    } catch (err) {
      console.error("Failed to load backgrounds:", err);
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
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
      });
      if (!path) return;
      await backgrounds.add(path);
      await new Promise(r => setTimeout(r, 300));
      await loadBackgrounds();
    } catch (err) {
      console.error("Failed to upload background:", err);
    }
  }

  async function removeBackground(entry) {
    const name = entry.split("|&")[0];
    if (selectedBg === name) setSelectedBg("fall");
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

  return (
    <>
      <div
        className="settings-background"
        style={{ backgroundImage: `url(${previewBg})` }}
      />
      <div className="settings-root">

        <div className="settings-main">
          <div className="settings-main-body">
            <h2 className="settings-title">Settings</h2>
            <p className="settings-subtitle">Choose your background</p>

            <div className="settings-toggle-row">
              <span className="settings-toggle-label">Federal Holidays</span>
              <button
                className={`settings-toggle-btn ${toggles.federal ? "settings-toggle-btn--on" : ""}`}
                onClick={() => flip('federal')}
                title="Show or hide US federal holidays"
              >
                {toggles.federal ? "On" : "Off"}
              </button>
            </div>

            <div className="settings-toggle-row">
              <span className="settings-toggle-label">Observances</span>
              <button
                className={`settings-toggle-btn ${toggles.observance ? "settings-toggle-btn--on" : ""}`}
                onClick={() => flip('observance')}
                title="Show or hide cultural observances like Earth Day, Halloween, etc."
              >
                {toggles.observance ? "On" : "Off"}
              </button>
            </div>

            <div className="settings-toggle-row">
              <span className="settings-toggle-label">Religious Observances</span>
              <button
                className={`settings-toggle-btn ${toggles.religious ? "settings-toggle-btn--on" : ""}`}
                onClick={() => flip('religious')}
                title="Show or hide religious observances like Easter, Good Friday, Hanukkah, etc."
              >
                {toggles.religious ? "On" : "Off"}
              </button>
            </div>

            <div className="settings-holiday-key">
              <span className="settings-toggle-label">
                Holiday key {keyStatus && (keyStatus.set ? "(set)" : "(not set, holidays are off)")}
              </span>
              <HolidayKeyForm country={keyStatus?.country} onSaved={() => holidaysApi.keyStatus().then(setKeyStatus)} />
            </div>

            <div className="settings-font-row">
              <span className="settings-toggle-label">Font</span>
              <input
                className="input"
                list="settings-font-list"
                placeholder="Default"
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

            <ThemePicker trim={trim} onChange={changeTrim} />

            <div className="settings-toggle-row">
              <span className="settings-toggle-label">Blur behind cells</span>
              <button
                className={`settings-toggle-btn ${look.cellBlur ? "settings-toggle-btn--on" : ""}`}
                onClick={() => setLook(l => ({ ...l, cellBlur: !l.cellBlur }))}
                title="Frosted glass effect behind the calendar cells and panels"
              >
                {look.cellBlur ? "On" : "Off"}
              </button>
            </div>

            <div className="settings-toggle-row">
              <span className="settings-toggle-label">Sharp cells</span>
              <button
                className={`settings-toggle-btn ${look.sharpCells ? "settings-toggle-btn--on" : ""}`}
                onClick={() => setLook(l => ({ ...l, sharpCells: !l.sharpCells }))}
                title="Square corners and crisp borders instead of rounded ones"
              >
                {look.sharpCells ? "On" : "Off"}
              </button>
            </div>

            <PresetsEditor />

            <div className="settings-bg-picker">
              {BG_MAP.map(bg => (
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
                    key={i}
                    className={`settings-bg-card ${selectedBg === name ? "settings-bg-card--selected" : ""}`}
                    onClick={() => setSelectedBg(name)}
                  >
                    <img src={convertFileSrc(path)} alt={name} className="settings-bg-img" />
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
          </div>

          <div className="settings-actions">
            <button className="btn" onClick={uploadBackground}>
              <Upload size={14} />&nbsp;Background
            </button>
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn" onClick={handleCancel}>Cancel</button>
          </div>
        </div>

        <div className="settings-sounds">
          <div className="settings-sounds-body">
            <h1 className="sound-subtitle">Alert Sound</h1>

            <div className="settings-volume-row">
              <span className="settings-volume-icon"><Volume size={16} /></span>
              <div className="settings-volume-slider-wrap">
                <input
                  className="settings-volume-slider"
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
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
          </div>

          <div className="settings-sounds-footer">
            <button className="btn" onClick={uploadSound}>
              <Upload size={14} />&nbsp;Add sound
            </button>
          </div>
        </div>

      </div>
    </>
  );
}