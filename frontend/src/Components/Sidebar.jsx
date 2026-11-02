import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Chat, Help } from "./Icons.jsx";
import { WEEKDAYS_SHORT, formatTime, getMonthCells, isSameDay } from "../lib/calendarUtils.js";
import { presetStyle } from "../lib/presets.js";
import { openChatWindow } from "../lib/windows.js";
import { isRangeSet, rangeLabel, readRange, writeRange } from "../lib/alarmRange.js";
import "./Sidebar.css";

const UPCOMING_COUNT = 5;
const BOOKMARKS_SHOWN = 6;

/* Today through N days ahead, as the yyyy-mm-dd strings the date inputs use */
function rangeFromToday(days) {
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const from = new Date();
  const to = new Date(from.getTime() + days * 86400000);
  return { from: iso(from), to: iso(to) };
}

export default function Sidebar({ currentDate, alarms, onSelectDate, onEditAlarm, onJumpToAlarm }) {
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

  const bookmarks = alarms
    .filter(a => a.bookmarked)
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, BOOKMARKS_SHOWN);

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

      {bookmarks.length > 0 && (
        <section className="sidebar-section">
          <h2 className="sidebar-heading">Bookmarks</h2>
          <ul className="upcoming-list bookmark-list">
            {bookmarks.map(alarm => (
              <li key={alarm.id ?? alarm.time}>
                <button
                  className="upcoming-item"
                  onClick={() => onJumpToAlarm(new Date(alarm.time))}
                  onDoubleClick={() => onEditAlarm(alarm)}
                  title="Click to jump to it, double-click to edit"
                  style={presetStyle(alarm.preset)}
                >
                  <span className="upcoming-when">
                    {new Date(alarm.time).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span className="upcoming-title">{alarm.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sidebar-section">
        <h2 className="sidebar-heading">Chat sees</h2>
        <div className="range-presets">
          <button onClick={() => updateRange(rangeFromToday(0))}>Today</button>
          <button onClick={() => updateRange(rangeFromToday(7))}>7 days</button>
          <button onClick={() => updateRange(rangeFromToday(30))}>30 days</button>
          <button onClick={() => updateRange({ from: "", to: "" })} disabled={!isRangeSet(range)}>All</button>
        </div>
        <div className="range-fields">
          <label>
            <span>From</span>
            <input
              type="date"
              value={range.from}
              max={range.to || undefined}
              onChange={(e) => updateRange({ ...range, from: e.target.value })}
            />
          </label>
          <label>
            <span>To</span>
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
