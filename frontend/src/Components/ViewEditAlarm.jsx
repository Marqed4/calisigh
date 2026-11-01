import { useState, useEffect, useRef } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getBackground } from "./backgrounds.js";
import { repeatIsos } from "./alarmUtils.js";
import "./AddAlarm.css";
import "./ViewEditAlarm.css";

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
      await fetch(`http://localhost:4567/api/alarms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time: iso, title, desc }),
      });
      await emit("alarm-saved");
      await getCurrentWindow().close();
    } catch { setError("Failed to save. Is the server running?"); }
  }

  /* Creates the repeats AFTER this alarm (this one already exists) */
  async function duplicateAlarm() {
    if (!futureDate) { setError("End date is required."); return; }
    try {
      for (const iso of repeatIsos({ year, month, day, time, endDate: futureDate, mode: repeatMode })) {
        await fetch("http://localhost:4567/api/alarms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ time: iso, title, desc }),
        });
      }
      await emit("alarm-saved");
      await getCurrentWindow().close();
    } catch { setError("Failed to duplicate. Is the server running?"); }
  }

  async function deleteAlarm() {
    try {
      await fetch(`http://localhost:4567/api/alarms/${id}`, { method: "DELETE" });
      await emit("alarm-saved");
      await getCurrentWindow().close();
    } catch { setError("Failed to delete. Is the server running?"); }
  }

  /* Enter saves (or confirms the repeat panel), Esc cancels */
  function handleKeyDown(e) {
    if (e.key === "Escape") getCurrentWindow().close();
    else if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "BUTTON") {
      e.preventDefault();
      if (showDuplicate) duplicateAlarm(); else saveAlarm();
    }
  }

  return (
    <>
      <div className="alarm-background" style={{ backgroundImage: `url(${bg})` }} />
      <div className="alarm-window" onKeyDown={handleKeyDown}>
        <h2>Edit Alarm</h2>
        <p>{`${month}/${day}/${year}`}</p>
        {error && <p className="alarm-error">{error}</p>}

        <input ref={titleRef} type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />

        {showDuplicate && (
          <div className="alarm-duplicate-panel">
            <p className="alarm-duplicate-label">Repeat until</p>

            <div className="alarm-repeat-toggle">
              <button
                className={`repeat-mode-btn ${repeatMode === "weekly" ? "repeat-mode-btn--active" : ""}`}
                onClick={() => setRepeatMode("weekly")}
              >Weekly</button>
              <button
                className={`repeat-mode-btn ${repeatMode === "yearly" ? "repeat-mode-btn--active" : ""}`}
                onClick={() => setRepeatMode("yearly")}
              >Yearly</button>
            </div>

            <input type="date" value={futureDate} onChange={(e) => setFutureDate(e.target.value)} />
            <div className="alarm-duplicate-actions">
              <button className="duplicate-confirm-btn" onClick={duplicateAlarm}>Confirm</button>
              <button className="duplicate-cancel-btn" onClick={() => { setShowDuplicate(false); setFutureDate(""); setError(""); }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="alarm-buttons">
          <button onClick={saveAlarm}>Save</button>
          <button className="duplicate-btn" onClick={() => setShowDuplicate(v => !v)}>Duplicate</button>
          <button className="delete-btn" onClick={deleteAlarm}>Delete</button>
          <button onClick={() => getCurrentWindow().close()}>Cancel</button>
        </div>
      </div>
    </>
  );
}
