import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Bell } from "../../shared/components/Icons.jsx";
import Linkified from "../../shared/text/Linkified.jsx";
import { getBackground } from "../appearance/backgrounds.js";
import { toLocalIso, toHHMM } from "./alarmUtils.js";
import { alarms, sounds } from "../../shared/lib/api.js";
import { notifyAlarmsChanged } from "../../shared/lib/windows.js";
import "./AlarmFiring.css";

async function silenceAlarm() {
  try {
    await sounds.stop();
    await alarms.clearFiring();
  } catch (e) {
    console.error("Failed to stop alarm:", e);
  }
}

export default function AlarmFiring() {
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

  /* Silence, then re-create the alarm N minutes out */
  async function snooze(minutes) {
    setStopping(true);
    try {
      const later = new Date(Date.now() + minutes * 60000);
      await alarms.create({ time: toLocalIso(later, toHHMM(later)), title, desc });
      await notifyAlarmsChanged();
    } catch (e) {
      console.error("Failed to snooze:", e);
    }
    await silenceAlarm();
    await getCurrentWindow().close();
  }

  /* Closing with the X must still silence the alarm */
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
      <div className="window-bg" style={{ backgroundImage: `url(${bg})` }} />
      <div className="alarm-firing-window">
        <div className="alarm-firing-icon"><Bell size={34} /></div>
        <h2 className="alarm-firing-title">{title}</h2>
        {desc && <p className="alarm-firing-desc"><Linkified text={desc} /></p>}
        <div className="alarm-firing-actions">
          <button className="btn" onClick={() => snooze(5)} disabled={stopping}>
            Snooze 5m
          </button>
          <button className="btn" onClick={() => snooze(10)} disabled={stopping}>
            Snooze 10m
          </button>
          <button
            className="btn btn-primary"
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
