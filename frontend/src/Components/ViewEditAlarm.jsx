import { useState, useEffect, useRef } from "react";
import PicturePicker from "./PicturePicker.jsx";
import { alarms } from "../lib/api.js";
import { closeThisWindow, finishAlarmEdit } from "../lib/windows.js";
import { getBackground } from "../lib/backgrounds.js";
import { repeatIsos } from "../lib/alarmUtils.js";
import "./AlarmWindow.css";

export default function ViewEditAlarm() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const day = params.get("day");
  const month = params.get("month");
  const year  = params.get("year");

  const [title, setTitle] = useState(params.get("title") || "");
  const [desc,  setDesc] = useState(params.get("desc")  || "");
  const [time,  setTime] = useState(params.get("time")  || "");
  const [error, setError] = useState("");
  const [imagePath, setImagePath] = useState(params.get("image") || "");
  /* untouched keeps the stored picture, a pick replaces it, a removal clears it */
  const [imageChange, setImageChange] = useState("keep");

  const [showDuplicate, setShowDuplicate] = useState(false);
  const [futureDate, setFutureDate] = useState("");
  const [repeatMode, setRepeatMode] = useState("weekly");
  const titleRef = useRef(null);

  const bg = getBackground();

  useEffect(() => { titleRef.current?.focus(); }, []);

  async function saveAlarm() {
    if (!title || !time) { setError("Title and time are required."); return; }
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${time}:00`;
    try {
      await alarms.update(id, {
        time: iso, title, desc,
        ...(imageChange === "set" && { imageSource: imagePath }),
        ...(imageChange === "clear" && { clearImage: true }),
      });
      await finishAlarmEdit();
    } catch { setError("Failed to save. Is the server running?"); }
  }

  /* Repeats come after this alarm, which already exists */
  async function duplicateAlarm() {
    if (!futureDate) { setError("End date is required."); return; }
    try {
      for (const iso of repeatIsos({ year, month, day, time, endDate: futureDate, mode: repeatMode })) {
        await alarms.create({ time: iso, title, desc, imageSource: imagePath });
      }
      await finishAlarmEdit();
    } catch { setError("Failed to duplicate. Is the server running?"); }
  }

  async function deleteAlarm() {
    try {
      await alarms.remove(id);
      await finishAlarmEdit();
    } catch { setError("Failed to delete. Is the server running?"); }
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") closeThisWindow();
    else if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "BUTTON") {
      e.preventDefault();
      if (showDuplicate) duplicateAlarm(); else saveAlarm();
    }
  }

  return (
    <>
      <div className="window-bg" style={{ backgroundImage: `url(${bg})` }} />
      <div className="alarm-window" onKeyDown={handleKeyDown}>
        <h2>Edit Alarm</h2>
        <p className="alarm-window-date">{`${month}/${day}/${year}`}</p>
        {error && <p className="form-error">{error}</p>}

        <input ref={titleRef} className="input" type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input" placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />

        <PicturePicker path={imagePath} onChange={(path) => { setImagePath(path); setImageChange(path ? "set" : "clear"); }} />

        {showDuplicate && (
          <div className="alarm-repeat-panel">
            <p className="alarm-repeat-label">Repeat until</p>

            <div className="segmented" role="tablist" aria-label="Repeat">
              {[["weekly", "Weekly"], ["yearly", "Yearly"]].map(([mode, label]) => (
                <button
                  key={mode}
                  role="tab"
                  aria-selected={repeatMode === mode}
                  className={`segmented-btn${repeatMode === mode ? " segmented-active" : ""}`}
                  onClick={() => setRepeatMode(mode)}
                >{label}</button>
              ))}
            </div>

            <input className="input" type="date" value={futureDate} onChange={(e) => setFutureDate(e.target.value)} />
            <div className="alarm-buttons">
              <button className="btn btn-primary" onClick={duplicateAlarm}>Confirm</button>
              <button className="btn" onClick={() => { setShowDuplicate(false); setFutureDate(""); setError(""); }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="alarm-buttons">
          <button className="btn btn-primary" onClick={saveAlarm}>Save</button>
          <button className="btn" onClick={() => setShowDuplicate(v => !v)}>Repeat</button>
          <button className="btn btn-danger" onClick={deleteAlarm}>Delete</button>
          <button className="btn" onClick={() => closeThisWindow()}>Cancel</button>
        </div>
      </div>
    </>
  );
}
