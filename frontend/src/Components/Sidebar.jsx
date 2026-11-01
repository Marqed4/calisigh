import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Chat, Help } from "./Icons.jsx";
import { WEEKDAYS_SHORT, formatTime, getMonthCells, isSameDay } from "../lib/calendarUtils.js";
import { openChatWindow } from "../lib/windows.js";
import { isRangeSet, rangeLabel, readRange, writeRange } from "../lib/alarmRange.js";
import "./Sidebar.css";

const UPCOMING_COUNT = 5;

export default function Sidebar({ currentDate, alarms, onSelectDate, onEditAlarm }) {
  const today = new Date();
  const cells = getMonthCells(currentDate);

  const [range, setRange] = useState(readRange);
  function updateRange(next) {
    setRange(next);
    writeRange(next);
  }

  const nowIso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const upcoming = alarms
    .filter(a => a.time >= nowIso)
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, UPCOMING_COUNT);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">Calisigh</div>

      <section className="sidebar-section">
        <h2 className="sidebar-heading">
          {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
        </h2>
        <div className="mini-grid">
          {WEEKDAYS_SHORT.map(d => <span key={d} className="mini-dow">{d[0]}</span>)}
          {cells.map(date => {
            const cls = ["mini-day"];
            if (date.getMonth() !== currentDate.getMonth()) cls.push("mini-outside");
            if (isSameDay(date, today)) cls.push("mini-today");
            if (isSameDay(date, currentDate)) cls.push("mini-selected");
            return (
              <button
                key={date.getTime()}
                className={cls.join(" ")}
                aria-label={date.toDateString()}
                onClick={() => onSelectDate(date)}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </section>

      <section className="sidebar-section sidebar-upcoming">
        <h2 className="sidebar-heading">Upcoming</h2>
        {upcoming.length === 0 && <p className="sidebar-empty">Nothing coming up. Suspicious.</p>}
        <ul className="upcoming-list">
          {upcoming.map(alarm => {
            const d = new Date(alarm.time);
            return (
              <li key={alarm.id ?? alarm.time}>
                <button className="upcoming-item" onClick={() => onEditAlarm(alarm)} title={alarm.desc || alarm.title}>
                  <span className="upcoming-when">
                    {d.toLocaleDateString([], { month: "short", day: "numeric" })} · {formatTime(alarm.time)}
                  </span>
                  <span className="upcoming-title">{alarm.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="sidebar-section">
        <h2 className="sidebar-heading">Chat sees</h2>
        <div className="range-fields">
          <label>
            From
            <input
              type="date"
              value={range.from}
              max={range.to || undefined}
              onChange={(e) => updateRange({ ...range, from: e.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={range.to}
              min={range.from || undefined}
              onChange={(e) => updateRange({ ...range, to: e.target.value })}
            />
          </label>
        </div>
        <div className="range-foot">
          <span className="range-label">{rangeLabel(range)}</span>
          {isRangeSet(range) && (
            <button className="range-clear" onClick={() => updateRange({ from: "", to: "" })}>Clear</button>
          )}
        </div>
      </section>

      <div className="sidebar-footer">
        <button className="sidebar-link" onClick={openChatWindow} title="Calisigh Bud / chat assistant">
          <Chat /> Chat
        </button>
        <button className="sidebar-link" onClick={() => openUrl("https://www.marqed.it/Calisigh")} title="About / FAQ">
          <Help /> FAQ
        </button>
      </div>
    </aside>
  );
}
