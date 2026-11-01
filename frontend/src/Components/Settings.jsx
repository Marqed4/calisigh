import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { DefaultBackgrounds } from "../resources/assets/images/Backgrounds/index.js";
import { FONT_THEMES, useFontTheme } from "./FontPackage.jsx";
import RemoveIcon from "../resources/assets/images/Signs/Red Remove.gif"
import VolumeIcon from "../resources/assets/images/Signs/Volume.gif";
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
];

function HoverGif({ inactive, active, onClick, title, className }) {
  const [hovered, setHovered] = useState(false);
  return (
    <img
      src={hovered ? active : inactive}
      alt={title}
      className={className}
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    />
  );
}

export default function Settings() {

  const { fontKey, setFontTheme, fontTheme } = useFontTheme();

  const SETTINGS = {
    CancelActive:   fontTheme.Settings.CancelActive,
    CancelInactive: fontTheme.Settings.CancelInactive,
    RemoveActive:   fontTheme.Settings.RemoveActive,
    RemoveInactive: fontTheme.Settings.RemoveInactive,
    SaveActive:     fontTheme.Settings.SaveActive,
    SaveInactive:   fontTheme.Settings.SaveInactive,
    UpdateActive:   fontTheme.Settings.UpdateActive,
    UpdateInactive: fontTheme.Settings.UpdateInactive,
    UploadActive:   fontTheme.Settings.UploadActive,
    UploadInactive: fontTheme.Settings.UploadInactive,
  };

  const [selectedBg, setSelectedBg] = useState(
    localStorage.getItem("calisigh-bg") ?? "fall"
  );
  const [showFederal,    setShowFederal]    = useState(() => localStorage.getItem("calisigh-holidays-federal")    !== "false");
  const [showObservance, setShowObservance] = useState(() => localStorage.getItem("calisigh-holidays-observance") !== "false");
  const [showReligious,  setShowReligious]  = useState(() => localStorage.getItem("calisigh-holidays-religious")  !== "false");
  const [customBackgrounds, setCustomBackgrounds] = useState([]);
  const [customSounds, setCustomSounds] = useState([]);
  const [selectedSound, setSelectedSound] = useState(
    localStorage.getItem("calisigh-sound") ?? null
  );
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
    loadBackgrounds();
    loadSounds();
    loadVolume();
  }, []);

  async function loadBackgrounds() {
    try {
      const res = await fetch("http://localhost:4567/api/backgrounds");
      const data = await res.json();
      setCustomBackgrounds(data);
    } catch (err) {
      console.error("Failed to load backgrounds:", err);
    }
  }

  async function loadSounds() {
    try {
      const [soundsRes, selectedRes] = await Promise.all([
        fetch("http://localhost:4567/api/sounds"),
        fetch("http://localhost:4567/api/sounds/selected"),
      ]);
      const sounds = await soundsRes.json();
      const selected = await selectedRes.json();
      setCustomSounds(sounds);
      if (selected && selected !== "") {
        setSelectedSound(selected);
        localStorage.setItem("calisigh-sound", selected);
      } else {
        setSelectedSound(null);
        localStorage.removeItem("calisigh-sound");
      }
    } catch (err) {
      console.error("Failed to load sounds:", err);
    }
  }

  async function loadVolume() {
    try {
      const res = await fetch("http://localhost:4567/api/sounds/volume");
      const data = await res.json();
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
        await fetch("http://localhost:4567/api/sounds/volume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ volume: val / 100 }),
        });
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
      await fetch("http://localhost:4567/api/backgrounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePath: path }),
      });
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
      await fetch("http://localhost:4567/api/backgrounds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
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
      await fetch("http://localhost:4567/api/sounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePath: path }),
      });
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
      await fetch("http://localhost:4567/api/sounds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      await loadSounds();
    } catch (err) {
      console.error("Failed to remove sound:", err);
    }
  }

  async function stopSound() {
    try {
      await fetch("http://localhost:4567/api/sounds/stop", { method: "POST" });
    } catch (err) {
      console.error("Failed to stop sound:", err);
    }
  }

  async function previewSound(name) {
    try {
      await fetch("http://localhost:4567/api/sounds/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    } catch (err) {
      console.error("Failed to preview sound:", err);
    }
  }

  async function save() {
    localStorage.setItem("calisigh-font", fontKey);
    localStorage.setItem("calisigh-bg", selectedBg);
    localStorage.setItem("calisigh-custom-bgs", JSON.stringify(customBackgrounds));
    localStorage.setItem("calisigh-holidays-federal",    String(showFederal));
    localStorage.setItem("calisigh-holidays-observance", String(showObservance));
    localStorage.setItem("calisigh-holidays-religious",  String(showReligious));
    if (selectedSound) localStorage.setItem("calisigh-sound", selectedSound);
    else localStorage.removeItem("calisigh-sound");
    try {
      await fetch("http://localhost:4567/api/sounds/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedSound ?? "" }),
      });
      await stopSound();
    } catch (_) {}
    await getCurrentWindow().close();
  }

  async function handleCancel() {
    await stopSound();
    await getCurrentWindow().close();
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
                className={`settings-toggle-btn ${showFederal ? "settings-toggle-btn--on" : ""}`}
                onClick={() => setShowFederal(v => !v)}
                title="Show or hide US federal holidays"
              >
                {showFederal ? "On" : "Off"}
              </button>
            </div>

            <div className="settings-toggle-row">
              <span className="settings-toggle-label">Observances</span>
              <button
                className={`settings-toggle-btn ${showObservance ? "settings-toggle-btn--on" : ""}`}
                onClick={() => setShowObservance(v => !v)}
                title="Show or hide cultural observances like Earth Day, Halloween, etc."
              >
                {showObservance ? "On" : "Off"}
              </button>
            </div>

            <div className="settings-toggle-row">
              <span className="settings-toggle-label">Religious Observances</span>
              <button
                className={`settings-toggle-btn ${showReligious ? "settings-toggle-btn--on" : ""}`}
                onClick={() => setShowReligious(v => !v)}
                title="Show or hide religious observances like Easter, Good Friday, Hanukkah, etc."
              >
                {showReligious ? "On" : "Off"}
              </button>
            </div>

            {Object.keys(FONT_THEMES).length > 1 && (
            <div className="settings-toggle-row">
              <span className="settings-toggle-label">Font Style</span>
              <select
                className="settings-font-select"
                value={fontKey}
                onChange={e => setFontTheme(e.target.value)}
              >
                {Object.entries(FONT_THEMES).map(([key, theme]) => (
                  <option key={key} value={key}>{theme.label}</option>
                ))}
              </select>
            </div>
            )}

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
                    <img
                      src={SETTINGS.RemoveInactive}
                      alt="Remove"
                      className="settings-bg-remove"
                      onClick={(e) => { e.stopPropagation(); removeBackground(entry); }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="settings-actions">
            <div className="settings-action-btn" onClick={uploadBackground}>
              <HoverGif inactive={SETTINGS.UploadInactive} 
              active={SETTINGS.UploadActive} title="Upload Background" 
              className="settings-upload-backgrounds-gif" />
            </div>
            <div className="settings-action-btn" onClick={save}>
              <HoverGif inactive={SETTINGS.SaveInactive} 
              active={SETTINGS.SaveActive} title="Save" 
              className="settings-save-gif" />
            </div>
            <div className="settings-action-btn" onClick={handleCancel}>
              <HoverGif inactive={SETTINGS.CancelInactive} 
              active={SETTINGS.CancelActive} title="Cancel" 
              className="settings-cancel-gif" />
            </div>
          </div>
        </div>

        <div className="settings-sounds">
          <div className="settings-sounds-body">
            <h1 className="sound-subtitle">Alert Sound</h1>

            <div className="settings-volume-row">
              {/* TODO: replace VolumeIcon with the correct asset once you confirm the file */}
              <img className="settings-volume-icon" src={VolumeIcon} alt="Volume" />
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
                    <img
                      src={ RemoveIcon }
                      alt="Remove"
                      className="settings-sound-remove"
                      onClick={(e) => { e.stopPropagation(); removeSound(entry); }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="settings-sounds-footer">
            <div className="settings-action-btn" onClick={uploadSound}>
              <HoverGif inactive={SETTINGS.UploadInactive} 
              active={SETTINGS.UploadActive} onClick={uploadSound} 
              title="Add Sound" className="settings-upload-songs-gif" />
            </div>
          </div>
        </div>

      </div>
    </>
  );
}