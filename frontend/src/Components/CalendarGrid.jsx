import { useRef, useState } from "react";
import { useFontTheme } from "./FontPackage.jsx";
import Remove from "../resources/assets/images/Signs/Red Remove.gif";
import "./CalendarGrid.css";

/* Local YYYY-MM-DD (toISOString would shift evening dates to the next day in UTC) */
function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* How many alarm chips fit in a cell before collapsing to "+N more" */
const MAX_VISIBLE_ALARMS = 2;

// shrink title so it fits the cell, cat
function abbreviateTitle(title) {
  if (!title) return "";
  const words = title.trim().split(/\s+/);
  if (words.length > 1) {
    return words.map(w => w[0]?.toUpperCase() ?? "").join("").slice(0, 4);
  }
  return title.length > 4 ? `${title.slice(0, 4)}.` : title;
}

export default function CalendarGrid({ calendarDays, currentDate, alarms, onDayClick, onDeleteAlarm, onEditAlarm, gridSize, holidays = {} }) {

  const { fontTheme }   = useFontTheme();
  const GraffitiNumbers = fontTheme.Numbers;
  const GraffitiDays    = fontTheme.Days;

  const [hoveredDay, setHoveredDay] = useState(null);
  // small delay so crossing into the popout to scroll it doesn't hide it, cat
  const hideTimeout = useRef(null);

  function cancelHide() {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
  }

  function scheduleHide() {
    cancelHide();
    hideTimeout.current = setTimeout(() => setHoveredDay(null), 150);
  }

  const DAY_NUMBERS = [
    null,
    GraffitiNumbers.Date1,  GraffitiNumbers.Date2,  GraffitiNumbers.Date3,
    GraffitiNumbers.Date4,  GraffitiNumbers.Date5,  GraffitiNumbers.Date6,
    GraffitiNumbers.Date7,  GraffitiNumbers.Date8,  GraffitiNumbers.Date9,
    GraffitiNumbers.Date10, GraffitiNumbers.Date11, GraffitiNumbers.Date12,
    GraffitiNumbers.Date13, GraffitiNumbers.Date14, GraffitiNumbers.Date15,
    GraffitiNumbers.Date16, GraffitiNumbers.Date17, GraffitiNumbers.Date18,
    GraffitiNumbers.Date19, GraffitiNumbers.Date20, GraffitiNumbers.Date21,
    GraffitiNumbers.Date22, GraffitiNumbers.Date23, GraffitiNumbers.Date24,
    GraffitiNumbers.Date25, GraffitiNumbers.Date26, GraffitiNumbers.Date27,
    GraffitiNumbers.Date28, GraffitiNumbers.Date29, GraffitiNumbers.Date30,
    GraffitiNumbers.Date31,
  ];

  const DAY_NUMBERS_INVERTED = [
    GraffitiNumbers.Inverted0,  GraffitiNumbers.Inverted1,  GraffitiNumbers.Inverted2,
    GraffitiNumbers.Inverted3,  GraffitiNumbers.Inverted4,  GraffitiNumbers.Inverted5,
    GraffitiNumbers.Inverted6,  GraffitiNumbers.Inverted7,  GraffitiNumbers.Inverted8,
    GraffitiNumbers.Inverted9,  GraffitiNumbers.Inverted10, GraffitiNumbers.Inverted11,
    GraffitiNumbers.Inverted12, GraffitiNumbers.Inverted13, GraffitiNumbers.Inverted14,
    GraffitiNumbers.Inverted15, GraffitiNumbers.Inverted16, GraffitiNumbers.Inverted17,
    GraffitiNumbers.Inverted18, GraffitiNumbers.Inverted19, GraffitiNumbers.Inverted20,
    GraffitiNumbers.Inverted21, GraffitiNumbers.Inverted22, GraffitiNumbers.Inverted23,
    GraffitiNumbers.Inverted24, GraffitiNumbers.Inverted25, GraffitiNumbers.Inverted26,
    GraffitiNumbers.Inverted27, GraffitiNumbers.Inverted28, GraffitiNumbers.Inverted29,
    GraffitiNumbers.Inverted30, GraffitiNumbers.Inverted31,
  ];

  const DAY_NAMES = [
    GraffitiDays.Sun, GraffitiDays.Mon, GraffitiDays.Tue,
    GraffitiDays.Wed, GraffitiDays.Thu, GraffitiDays.Fri,
    GraffitiDays.Sat
  ];

  const DAY_NAMES_INVERTED = [
    GraffitiDays.SunInverted, GraffitiDays.MonInverted,
    GraffitiDays.TueInverted, GraffitiDays.WedInverted, GraffitiDays.ThuInverted,
    GraffitiDays.FriInverted, GraffitiDays.SatInverted
  ];

  function getHoliday(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const key = `${year}-${month}-${day}`;
    return holidays[key] ?? null;
  }

  return (
    <div className="calendar-grid" style={{ width: gridSize, height: gridSize }}>
      {DAY_NAMES.map((gif, i) => (
        <div key={i} className="day">
          <img src={gif} alt={DAY_NAMES[i]} className="day-gif" />
        </div>
      ))}
      {calendarDays.map((date, i) => {
        const isToday = date && date.toDateString() === new Date().toDateString();
        const holiday = getHoliday(date);
        // earliest to latest, cat
        const dayAlarms = date
          ? alarms
              .filter(a => a.time?.startsWith(dateKey(date)))
              .sort((a, b) => new Date(a.time) - new Date(b.time))
          : [];
        return (
          <div
            key={i}
            className={`day-cell ${isToday ? "today" : ""} ${holiday ? "day-cell--holiday" : ""}`}
            onClick={() => onDayClick(date)}
            // title on the cell, cat
            title={holiday ? holiday.map(h => h.name).join(" · ") : undefined}
            // hover the cell, see all its events, cat
            onMouseEnter={(e) => {
              if (!dayAlarms.length) return;
              cancelHide();
              const rect = e.currentTarget.getBoundingClientRect();
              setHoveredDay({ alarms: dayAlarms, x: rect.right, y: rect.top });
            }}
            onMouseLeave={scheduleHide}
          >
            {date && (
              <>
                <div className="day-cell-header">
                  <img
                    src={isToday ? DAY_NUMBERS_INVERTED[date.getDate()] : DAY_NUMBERS[date.getDate()]}
                    alt={date.getDate()}
                    className="day-number-img"
                  />
                  {holiday && (
                    <span className="holiday-label">
                      {holiday.map(h => h.shortName).join(" · ")}
                    </span>
                  )}
                </div>
                {dayAlarms.slice(0, MAX_VISIBLE_ALARMS).map((alarm, idx) => (
                  <div
                    key={idx}
                    className="alarm"
                    onClick={(e) => { e.stopPropagation(); onEditAlarm?.(alarm); }}
                  >
                    <span className="alarm-title">{abbreviateTitle(alarm.title)}</span>
                    <span className="alarm-time">
                      {new Date(alarm.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <img
                      src={Remove}
                      alt="Remove"
                      className="alarm-delete"
                      onClick={(e) => { e.stopPropagation(); onDeleteAlarm(alarm); }}
                    />
                  </div>
                ))}
                {dayAlarms.length > MAX_VISIBLE_ALARMS && (
                  <span className="alarm-more">+{dayAlarms.length - MAX_VISIBLE_ALARMS} more</span>
                )}
              </>
            )}
          </div>
        );
      })}
      {hoveredDay && (
        <div
          className="alarm-tooltip"
          style={{ left: hoveredDay.x, top: hoveredDay.y }}
          // stay open and scrollable while the mouse is on it, cat
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          {hoveredDay.alarms.map((alarm, idx) => (
            <div key={idx} className="alarm-tooltip-entry">
              <h3>{alarm.title}</h3>
              <p>{alarm.desc || "No description"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}