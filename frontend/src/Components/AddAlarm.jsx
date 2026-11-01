import { useState, useEffect, useRef } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getBackground } from "./backgrounds.js";
import { repeatIsos } from "./alarmUtils.js";
import "./AddAlarm.css";
import "./ViewEditAlarm.css"; /* reuses the repeat toggle + panel styles */

export default function AddAlarm() {
  // Pull the date from the query params passed when the window was opened
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
  const titleRef = useRef(null);

  const bg = getBackground();

  useEffect(() => { titleRef.current?.focus(); }, []);

  async function post(iso) {
    await fetch("http://localhost:4567/api/alarms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ time: iso, title, desc }),
    });
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

    // Build the ISO timestamp from the date params and the time input
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${time}:00`;

    try {
      await post(iso);
      if (repeatMode !== "none") {
        for (const next of repeatIsos({ year, month, day, time, endDate, mode: repeatMode })) {
          await post(next);
        }
      }
      // Tell Home.jsx to reload its alarms, then close this window
      await emit("alarm-saved");
      await getCurrentWindow().close();
    } catch (err) {
      setError("Failed to save alarm. Is the server running?");
    }
  }

  async function handleCancel() {
    await getCurrentWindow().close();
  }

  /* Enter saves (except inside the description box), Esc cancels */
  function handleKeyDown(e) {
    if (e.key === "Escape") handleCancel();
    else if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "BUTTON") {
      e.preventDefault();
      saveAlarm();
    }
  }

  return (
    <>
      <div className="alarm-background" style={{ backgroundImage: `url(${bg})` }} />
      <div className="alarm-window" onKeyDown={handleKeyDown}>
        <h2>Add Alarm</h2>
        <p>{`${month}/${day}/${year}`}</p>
        {error && <p className="alarm-error">{error}</p>}
        <input
          ref={titleRef}
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />

        <div className="alarm-repeat-toggle">
          {[["none", "No repeat"], ["weekly", "Weekly"], ["yearly", "Yearly"]].map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`repeat-mode-btn ${repeatMode === mode ? "repeat-mode-btn--active" : ""}`}
              onClick={() => setRepeatMode(mode)}
            >{label}</button>
          ))}
        </div>

        {repeatMode !== "none" && (
          <div className="alarm-duplicate-panel">
            <p className="alarm-duplicate-label">Repeat until</p>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        )}

        <div className="alarm-buttons">
          <button onClick={saveAlarm}>Save</button>
          <button onClick={handleCancel}>Cancel</button>
        </div>
      </div>
    </>
  );
}
