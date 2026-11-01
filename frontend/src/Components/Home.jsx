import { useEffect, useState } from "react";
import ViewYears from "./ViewYears.jsx";
import CalendarGrid from "./CalendarGrid.jsx";
import WeekView from "./WeekView.jsx";
import Sidebar from "./Sidebar.jsx";
import { ChevronLeft, ChevronRight, Settings as SettingsIcon } from "./Icons.jsx";
import { useAlarms } from "../hooks/useAlarms.js";
import { useAppSettings } from "../hooks/useAppSettings.js";
import { useFiringAlarm } from "../hooks/useFiringAlarm.js";
import { useHolidays } from "../hooks/useHolidays.js";
import { addDays, weekLabel } from "../lib/calendarUtils.js";
import { savedView } from "../lib/settings.js";
import { openAddAlarmWindow, openEditAlarmWindow, openSettingsWindow } from "../lib/windows.js";
import "./Home.css";

const VIEWS = [
  { key: "month", label: "Month", hotkey: "M" },
  { key: "week",  label: "Week",  hotkey: "W" },
  { key: "year",  label: "Year",  hotkey: "Y" },
];
const VIEW_KEYS = VIEWS.map(v => v.key);

export default function Home() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setViewState] = useState(() => savedView.read(VIEW_KEYS));

  const { bg, toggles, look } = useAppSettings();
  const { alarms, ready, lastDeleted, remove, undo } = useAlarms();
  const holidays = useHolidays(currentDate.getFullYear(), toggles);
  useFiringAlarm(ready);

  function setView(key) {
    setViewState(key);
    savedView.write(key);
  }

  /* Always land on the 1st so Jan 31 + 1 month can't skip February */
  function step(direction) {
    if (view === "month") setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + direction, 1));
    else if (view === "week") setCurrentDate(d => addDays(d, 7 * direction));
    else setCurrentDate(d => new Date(d.getFullYear() + direction, d.getMonth(), 1));
  }

  const goToday = () => setCurrentDate(new Date());

  /* Left/right = previous/next, T = today, M/W/Y = view, Esc = leave year view */
  useEffect(() => {
    function onKeyDown(e) {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (e.key === "Escape" && view === "year") setView("month");
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (key === "t") goToday();
      else if (key === "m") setView("month");
      else if (key === "w") setView("week");
      else if (key === "y") setView("year");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view]);

  const now = new Date();
  const isCurrent =
    view === "year"
      ? currentDate.getFullYear() === now.getFullYear()
      : view === "month"
        ? currentDate.getFullYear() === now.getFullYear() && currentDate.getMonth() === now.getMonth()
        : weekLabel(currentDate) === weekLabel(now);

  const title =
    view === "year" ? String(currentDate.getFullYear())
    : view === "week" ? weekLabel(currentDate)
    : currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const viewProps = {
    currentDate,
    alarms,
    holidays,
    onDayClick: openAddAlarmWindow,
    onEditAlarm: openEditAlarmWindow,
    onDeleteAlarm: remove,
  };

  return (
    <div className="background-wrapper" style={{ backgroundImage: `url(${bg})` }}>
      <div className="app-container" data-blur={look.cellBlur ? "on" : "off"} data-cells={look.sharpCells ? "sharp" : "soft"}>
        <Sidebar
          currentDate={currentDate}
          alarms={alarms}
          onSelectDate={setCurrentDate}
          onEditAlarm={openEditAlarmWindow}
        />
        <main className="main">
          <header className="toolbar">
            <div className="toolbar-nav">
              <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous" title="Previous (Left arrow)">
                <ChevronLeft />
              </button>
              <button className="icon-btn" onClick={() => step(1)} aria-label="Next" title="Next (Right arrow)">
                <ChevronRight />
              </button>
              <button className="btn" onClick={goToday} disabled={isCurrent} title="Jump to today (T)">
                Today
              </button>
            </div>

            <h1 className="toolbar-title">{title}</h1>

            <div className="toolbar-end">
              <div className="segmented" role="tablist" aria-label="Calendar view">
                {VIEWS.map(v => (
                  <button
                    key={v.key}
                    role="tab"
                    aria-selected={view === v.key}
                    className={`segmented-btn${view === v.key ? " segmented-active" : ""}`}
                    onClick={() => setView(v.key)}
                    title={`${v.label} view (${v.hotkey})`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <button className="icon-btn" onClick={openSettingsWindow} aria-label="Settings" title="Settings">
                <SettingsIcon />
              </button>
            </div>
          </header>

          <div className="view-area">
            {view === "month" && (
              <CalendarGrid
                {...viewProps}
                onShowDay={(date) => { setCurrentDate(date); setView("week"); }}
              />
            )}
            {view === "week" && <WeekView {...viewProps} />}
            {view === "year" && (
              <ViewYears
                currentDate={currentDate}
                alarms={alarms}
                onSelectMonth={(year, month) => {
                  setCurrentDate(new Date(year, month, 1));
                  setView("month");
                }}
              />
            )}
          </div>
        </main>

        {lastDeleted && (
          <div className="undo-toast" role="status">
            <span>Alarm deleted</span>
            <button onClick={undo}>Undo</button>
          </div>
        )}
      </div>
    </div>
  );
}
