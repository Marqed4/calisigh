import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import Settings from "../resources/assets/images/Signs/Settings.gif";
import { useFontTheme, DEFAULT_FONT } from "./FontPackage.jsx";
import { getBackground } from "./backgrounds.js";
import MonthYearDisplay from "./MonthYearDisplay.jsx";
import ViewYears from "./ViewYears.jsx";
import CalendarGrid from "./CalendarGrid.jsx";
import Sidebar from "./Sidebar.jsx";
import "./MonthYearDisplay.css";
import ".//ViewYears.css"
import "./Home.css";

/* Read a boolean toggle from localStorage, defaults to true if not set */
function readToggle(key) {
  return localStorage.getItem(key) !== "false";
}

/* Open a named webview window, or focus it if already open */
async function openWindow(label, url, options = {}) {
  console.log("openWindow called", label);
  try {
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.show();
      await existing.setFocus();
      return;
    }
    const win = new WebviewWindow(label, {
      url,
      resizable: false,
      center: true,
      parent: "main",
      ...options,
    });
    win.once("tauri://error", (e) => console.error(`${label} error:`, e));
    win.once("tauri://created", () => console.log(`${label} created`));
  } catch (err) {
    console.error(`Failed to open ${label}:`, err);
  }
}

/*
  Poll until the Java backend is ready,
  if it never comes up reload the window so it retries on next show.
  See is_autostart in main.rs
*/
async function waitForBackend(retries = 20, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch("http://localhost:4567/api/alarms");
      if (res.ok) return true;
    } catch (_) {}
    await new Promise(r => setTimeout(r, delayMs));
  }
  window.location.reload();
  return false;
}

export default function Home() {
  const { setFontTheme } = useFontTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [alarms, setAlarms] = useState([]);
  const [holidays, setHolidays] = useState({});
  const [gridSize, setGridSize] = useState(0);
  const [isYearView, setIsYearView] = useState(false);

  const [showFederal,    setShowFederal]    = useState(() => readToggle("calisigh-holidays-federal"));
  const [showObservance, setShowObservance] = useState(() => readToggle("calisigh-holidays-observance"));
  const [showReligious,  setShowReligious]  = useState(() => readToggle("calisigh-holidays-religious"));

  const Main = useRef(null);
  const alarmWindowOpen = useRef(false);
  const pollerRef = useRef(null);
  const undoTimer = useRef(null);
  const [lastDeleted, setLastDeleted] = useState(null);

  const [bg, setBg] = useState(getBackground());

  /* Refresh background and holiday toggles whenever the window regains focus */
  useEffect(() => {
    const onFocus = () => {
      setBg(getBackground());
      setShowFederal(readToggle("calisigh-holidays-federal"));
      setShowObservance(readToggle("calisigh-holidays-observance"));
      setShowReligious(readToggle("calisigh-holidays-religious"));
      setFontTheme(localStorage.getItem("calisigh-font") ?? DEFAULT_FONT);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  /* On mount, wait for backend then load alarms and start the firing poller */
  useEffect(() => {
    let cancelled = false;
    waitForBackend().then(ready => {
      if (ready && !cancelled) {
        loadAlarms();
        startAlarmFiringPoller();
      }
    });
    const unlisten = listen("alarm-saved", () => loadAlarms());
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => {
      cancelled = true;
      clearInterval(pollerRef.current);
      clearTimeout(undoTimer.current);
      unlisten.then(f => f());
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  /* Keyboard shortcuts: left/right = month, T = today, Esc = leave year view */
  useEffect(() => {
    function onKeyDown(e) {
      const tag = e.target?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape" && isYearView) setIsYearView(false);
      else if (!isYearView && e.key === "ArrowLeft")  changeMonth(-1);
      else if (!isYearView && e.key === "ArrowRight") changeMonth(1);
      else if (e.key === "t" || e.key === "T") goToday();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isYearView]);

  /* Reload holidays when the year or any toggle changes */
  useEffect(() => {
    loadHolidays(currentDate.getFullYear());
  }, [currentDate.getFullYear(), showFederal, showObservance, showReligious]);

  async function loadHolidays(year) {
    const categories = [];
    if (showFederal)    categories.push("federal");
    if (showObservance) categories.push("observance");
    if (showReligious)  categories.push("religious");

    if (categories.length === 0) {
      setHolidays({});
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:4567/api/holidays?year=${year}&categories=${categories.join(",")}`
      );
      const data = await res.json();
      /* Store An array per date */
      const map = {};
      for (const h of data) {
        if (!map[h.date]) map[h.date] = [];
        map[h.date].push(h);
      }
      setHolidays(map);
    } catch (err) {
      console.error("Failed to load holidays:", err);
    }
  }

  async function loadAlarms() {
    try {
      const res = await fetch("http://localhost:4567/api/alarms");
      const data = await res.json();
      setAlarms(data);
    } catch (err) {
      console.error("Failed to load alarms:", err);
    }
  }

  /* Check every second if an alarm is firing, open the alert window if so */
  function startAlarmFiringPoller() {
    clearInterval(pollerRef.current);
    pollerRef.current = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:4567/api/alarms/firing");
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.firing && !alarmWindowOpen.current) {
          alarmWindowOpen.current = true;
          const query = new URLSearchParams({
            title: data.title || "",
            desc:  data.desc  || "",
          }).toString();
          const existing = await WebviewWindow.getByLabel("alarm-firing");
          if (existing) {
            await existing.show();
            await existing.setFocus();
          } else {
            const win = new WebviewWindow("alarm-firing", {
              url: `/alarm-firing?${query}`,
              resizable: false,
              center: true,
              width: 320,
              height: 320,
              title: "Alarm",
              alwaysOnTop: true,
              skipTaskbar: false,
            });
            /* Reset the flag once the alarm window is closed */
            win.once("tauri://destroyed", () => {
              alarmWindowOpen.current = false;
            });
          }
        }
        if (data && !data.firing) {
          alarmWindowOpen.current = false;
        }
      } catch (_) {}
    }, 1000);
  }

  /* Fit the calendar grid to the available space below the nav */
  function updateSize() {
    if (Main.current) {
      const { width, height } = Main.current.getBoundingClientRect();
      const navHeight = document.querySelector(".top-nav")?.getBoundingClientRect().height ?? 55;
      setGridSize(Math.min(width, height - navHeight));
    }
  }

  /* Delete, then offer a few seconds to undo it */
  async function deleteAlarm(alarm) {
    try {
      await fetch("http://localhost:4567/api/alarms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alarm.id, time: alarm.time }),
      });
      loadAlarms();
      clearTimeout(undoTimer.current);
      setLastDeleted(alarm);
      undoTimer.current = setTimeout(() => setLastDeleted(null), 6000);
    } catch (err) {
      console.error("Failed to delete alarm:", err);
    }
  }

  async function undoDelete() {
    const alarm = lastDeleted;
    if (!alarm) return;
    clearTimeout(undoTimer.current);
    setLastDeleted(null);
    try {
      await fetch("http://localhost:4567/api/alarms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time: alarm.time, title: alarm.title, desc: alarm.desc ?? "" }),
      });
      loadAlarms();
    } catch (err) {
      console.error("Failed to restore alarm:", err);
    }
  }

  async function openAlarmWindow(date) {
    if (!date) return;
    await openWindow("add-alarm", `/add-alarm?day=${date.getDate()}&month=${currentDate.getMonth() + 1}&year=${currentDate.getFullYear()}`);
  }

  /* Pass all alarm fields as query params so the edit window can pre-fill */
  async function openEditWindow(alarm) {
    const dt = new Date(alarm.time);
    const query = new URLSearchParams({
      id: alarm.id ?? alarm.time,
      title: alarm.title,
      desc: alarm.desc ?? "",
      day: dt.getDate(),
      month: dt.getMonth() + 1,
      year: dt.getFullYear(),
      time: alarm.time.slice(11, 16),
    }).toString();
    await openWindow("view-edit-alarm", `/view-edit-alarm?${query}`);
  }

  const openSettingsWindow = () => openWindow("view-settings", "/view-settings", { title: "Settings" });

  /* Always land on the 1st so Jan 31 + 1 month can't skip February */
  function changeMonth(offset) {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + offset, 1));
  }

  function goToday() {
    setCurrentDate(new Date());
    setIsYearView(false);
  }

  const now = new Date();
  const isCurrentMonth =
    currentDate.getFullYear() === now.getFullYear() &&
    currentDate.getMonth() === now.getMonth();

  function getCalendarDays(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    /* Pad the front with nulls so the first day lands on the right weekday */
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    return days;
  }

  const calendarDays = getCalendarDays(currentDate);

  return (
    <div className="background-wrapper" style={{ backgroundImage: `url(${bg})` }}>
      <div className="app-container">
        <Sidebar currentDate={currentDate} calendarDays={calendarDays} />
        <main className="main" ref={Main}>
          {isYearView ? (
            <ViewYears
              currentDate={currentDate}
              onToggleYearView={() => setIsYearView(false)}
              onSelectYear={(year) => {
                setCurrentDate(new Date(year, 0, 1));
                setIsYearView(false);
              }}
            />
          ) : (
            <>
              <MonthYearDisplay
                currentDate={currentDate}
                onPrev={() => changeMonth(-1)}
                onNext={() => changeMonth(1)}
                viewYears={() => setIsYearView(true)}
              />
              <CalendarGrid
                calendarDays={calendarDays}
                currentDate={currentDate}
                alarms={alarms}
                onDayClick={openAlarmWindow}
                onDeleteAlarm={deleteAlarm}
                onEditAlarm={openEditWindow}
                gridSize={gridSize}
                holidays={holidays}
              />
            </>
          )}
        </main>
        {!isCurrentMonth && (
          <button className="today-btn" onClick={goToday} title="Jump to the current month (T)">
            Today
          </button>
        )}
        {lastDeleted && (
          <div className="undo-toast">
            <span>Alarm deleted</span>
            <button onClick={undoDelete}>Undo</button>
          </div>
        )}
        <a
          className="settings-link"
          title="Calisigh's Settings"
          onClick={(e) => { e.preventDefault(); openSettingsWindow(); }}
          style={{ cursor: "pointer" }}
        >
          <img src={Settings} 
          className="settings-header" 
          alt="Settings" />
        </a>
      </div>
    </div>
  );
}