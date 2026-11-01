import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Bell from "../resources/assets/images/Signs/Bell.gif?url";
import { getBackground } from "./backgrounds.js";
import { toLocalIso, toHHMM } from "./alarmUtils.js";
import "./AlarmFiring.css";

/* Stop the sound and clear the backend's firing state */
async function silenceAlarm() {
  try {
    await fetch("http://localhost:4567/api/sounds/stop", { method: "POST" });
    await fetch("http://localhost:4567/api/alarms/firing", { method: "DELETE" });
  } catch (e) {
    console.error("Failed to stop alarm:", e);
  }
}

export default function AlarmFiring() {
  // Pull the alarm title and description from the query params
  const params = new URLSearchParams(window.location.search);
  const title = params.get("title") || "Alarm";
  const desc  = params.get("desc")  || "";

  const [stopping, setStopping] = useState(false);
  const bg = getBackground();

  async function stopAlarm() {
    setStopping(true);
    await silenceAlarm();
    await getCurrentWindow().close();
  }

  /* Silence now, and re-create this alarm N minutes from now */
  async function snooze(minutes) {
    setStopping(true);
    try {
      const later = new Date(Date.now() + minutes * 60000);
      await fetch("http://localhost:4567/api/alarms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time: toLocalIso(later, toHHMM(later)), title, desc }),
      });
      await emit("alarm-saved"); // so the main calendar shows the snoozed alarm
    } catch (e) {
      console.error("Failed to snooze:", e);
    }
    await silenceAlarm();
    await getCurrentWindow().close();
  }

  /*
    If the user closes the window with the X button instead of Stop,
    we still need to stop the sound and clear the firing state.
    preventDefault lets us do cleanup before actually destroying the window.
  */
  useEffect(() => {
    const win = getCurrentWindow();
    const unlistenPromise = win.onCloseRequested(async (event) => {
      event.preventDefault();
      await silenceAlarm();
      await win.destroy();
    });
    return () => { unlistenPromise.then(f => f()); };
  }, []);

  return (
    <>
      <div className="alarm-background" style={{ backgroundImage: `url(${bg})` }} />
      <div className="alarm-firing-window">
        <img src={Bell} className="alarm-firing-icon" alt="Alarm" />
        <h2 className="alarm-firing-title">{title}</h2>
        {desc && <p className="alarm-firing-desc">{desc}</p>}
        <div className="alarm-firing-actions">
          <button className="alarm-firing-stop alarm-firing-snooze" onClick={() => snooze(5)} disabled={stopping}>
            Snooze 5m
          </button>
          <button className="alarm-firing-stop alarm-firing-snooze" onClick={() => snooze(10)} disabled={stopping}>
            Snooze 10m
          </button>
          <button
            className={`alarm-firing-stop ${stopping ? "alarm-firing-stop--stopping" : ""}`}
            onClick={stopAlarm}
            disabled={stopping}
          >
            {stopping ? "Stopping..." : "Stop"}
          </button>
        </div>
      </div>
    </>
  );
}
