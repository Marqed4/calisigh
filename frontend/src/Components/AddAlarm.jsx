import { useState, useEffect, useRef } from "react";
import HighlightInput from "./HighlightInput.jsx";
import PicturePicker from "./PicturePicker.jsx";
import PresetSelect, { usePresets } from "./PresetSelect.jsx";
import { alarms, marks } from "../lib/api.js";
import { closeThisWindow, finishAlarmEdit } from "../lib/windows.js";
import { getBackground } from "../lib/backgrounds.js";
import { repeatIsos } from "../lib/alarmUtils.js";
import { formatTotals, sumAmounts } from "../lib/money.js";
import "./AlarmWindow.css";

export default function AddAlarm() {
  const params = new URLSearchParams(window.location.search);
  const day = params.get("day");
  const month = params.get("month");
  const year = params.get("year");

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const [repeatMode, setRepeatMode] = useState("none"); // none | weekly | yearly
  const [endDate, setEndDate] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [presetId, setPresetId] = useState("");
  const [bookmarked, setBookmarked] = useState(false);
  const titleRef = useRef(null);
  const presets = usePresets();

  const typedTotal = formatTotals(sumAmounts([{ title, desc }]));
  const bg = getBackground();

  useEffect(() => { titleRef.current?.focus(); }, []);

  /* A preset only fills the title and text that are still empty */
  function choosePreset(id, preset) {
    setPresetId(id);
    if (!preset) return;
    if (!title && preset.title) setTitle(preset.title);
    if (!desc && preset.desc) setDesc(preset.desc);
  }

  async function post(iso) {
    const res = await alarms.create({ time: iso, title, desc, imageSource: imagePath });
    if (presetId || bookmarked) {
      const { id } = await res.json();
      if (id) await marks.set(id, { bookmarked, preset: presetId });
    }
  }

  async function saveAlarm() {
    if (!title || !time) {
      setError("Title and time are required.");
      return;
    }
    if (repeatMode !== "none" && !endDate) {
      setError("Pick a date to repeat until.");
      return;
    }

    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${time}:00`;

    try {
      await post(iso);
      if (repeatMode !== "none") {
        for (const next of repeatIsos({ year, month, day, time, endDate, mode: repeatMode })) {
          await post(next);
        }
      }
      await finishAlarmEdit();
    } catch (err) {
      setError("Failed to save alarm. Is the server running?");
    }
  }

  async function handleCancel() {
    await closeThisWindow();
  }

  /* Enter saves (not in the description box), Esc cancels */
  function handleKeyDown(e) {
    if (e.key === "Escape") handleCancel();
    else if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "BUTTON") {
      e.preventDefault();
      saveAlarm();
    }
  }

  return (
    <>
      <div className="window-bg" style={{ backgroundImage: `url(${bg})` }} />
      <div className="alarm-window" onKeyDown={handleKeyDown}>
        <h2>Add Alarm</h2>
        <p className="alarm-window-date">{`${month}/${day}/${year}`}</p>
        {error && <p className="form-error">{error}</p>}
        <HighlightInput
          ref={titleRef}
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <HighlightInput
          multiline
          className="input"
          placeholder="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        {typedTotal && <p className="alarm-money-total">Amounts here add up to {typedTotal}</p>}
        <input
          className="input"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />

        <PresetSelect presets={presets} value={presetId} onChange={choosePreset} />

        <label className="alarm-check">
          <input type="checkbox" checked={bookmarked} onChange={(e) => setBookmarked(e.target.checked)} />
          Bookmark this event
        </label>

        <PicturePicker path={imagePath} onChange={setImagePath} />

        <div className="segmented" role="tablist" aria-label="Repeat">
          {[["none", "No repeat"], ["weekly", "Weekly"], ["yearly", "Yearly"]].map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={repeatMode === mode}
              className={`segmented-btn${repeatMode === mode ? " segmented-active" : ""}`}
              onClick={() => setRepeatMode(mode)}
            >{label}</button>
          ))}
        </div>

        {repeatMode !== "none" && (
          <div className="alarm-repeat-panel">
            <p className="alarm-repeat-label">Repeat until</p>
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        )}

        <div className="alarm-buttons">
          <button className="btn btn-primary" onClick={saveAlarm}>Save</button>
          <button className="btn" onClick={handleCancel}>Cancel</button>
        </div>
      </div>
    </>
  );
}
