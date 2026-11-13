import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Bell } from "../../shared/components/Icons.jsx";
import { getBackground } from "../appearance/backgrounds.js";
import { dedupeAlarms } from "./alarmUtils.js";
import { alarms } from "../../shared/lib/api.js";
import "./MissedAlarms.css";

const formatTime = (iso) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/* Alarms that came due while the app was closed. Dismiss clears them on the backend. */
export default function MissedAlarms() {
  const [missed, setMissed] = useState([]);
  const bg = getBackground();

  useEffect(() => {
    alarms.missed().then(list => setMissed(dedupeAlarms(list)));
  }, []);

  async function dismiss() {
    try {
      await alarms.clearMissed();
    } catch (e) {
      console.error("Failed to clear missed alarms:", e);
    }
    await getCurrentWindow().close();
  }

  return (
    <>
      <div className="window-bg" style={{ backgroundImage: `url(${bg})` }} />
      <div className="missed-window">
        <h2 className="missed-title"><Bell size={20} />Missed while you were away</h2>
        {missed.length === 0 ? (
          <p className="missed-empty">Nothing missed.</p>
        ) : (
          <ul className="missed-list">
            {missed.map(a => (
              <li key={a.id} className="missed-item">
                <div className="missed-item-title">{a.title}</div>
                <div className="missed-item-time">{formatTime(a.time)}</div>
                {a.desc && <p className="missed-item-desc">{a.desc}</p>}
              </li>
            ))}
          </ul>
        )}
        <button className="btn btn-primary" onClick={dismiss}>Dismiss</button>
      </div>
    </>
  );
}
