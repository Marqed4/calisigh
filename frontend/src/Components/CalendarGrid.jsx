import { convertFileSrc } from "@tauri-apps/api/core";
import { Close } from "./Icons.jsx";
import { WEEKDAYS_SHORT, alarmsOn, dateKey, formatTime, getMonthCells, isSameDay } from "../lib/calendarUtils.js";
import "./CalendarGrid.css";

/* Chips shown per cell before "+N more" */
const MAX_VISIBLE_ALARMS = 2;

export function AlarmChip({ alarm, onEdit, onDelete }) {
  return (
    <div
      className="chip"
      role="button"
      tabIndex={0}
      title={alarm.desc ? `${alarm.title}\n${alarm.desc}` : alarm.title}
      onClick={(e) => { e.stopPropagation(); onEdit(alarm); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onEdit(alarm);
        }
      }}
    >
      <span className="chip-time">{formatTime(alarm.time)}</span>
      <span className="chip-title">{alarm.title}</span>
      <button
        className="chip-delete"
        aria-label={`Delete ${alarm.title}`}
        title="Delete"
        onClick={(e) => { e.stopPropagation(); onDelete(alarm); }}
      >
        <Close size={12} />
      </button>
    </div>
  );
}

export default function CalendarGrid({ currentDate, alarms, holidays = {}, onDayClick, onEditAlarm, onDeleteAlarm, onShowDay }) {
  const today = new Date();
  const cells = getMonthCells(currentDate);

  return (
    <div className="month-view">
      <div className="month-weekdays">
        {WEEKDAYS_SHORT.map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="month-grid">
        {cells.map(date => {
          const outside = date.getMonth() !== currentDate.getMonth();
          const isToday = isSameDay(date, today);
          const holiday = holidays[dateKey(date)];
          const dayAlarms = alarmsOn(alarms, date);
          const hidden = dayAlarms.length - MAX_VISIBLE_ALARMS;
          const picture = dayAlarms.find(a => a.image)?.image;

          return (
            <div
              key={date.getTime()}
              className={`cell${outside ? " cell-outside" : ""}${isToday ? " cell-today" : ""}${picture ? " has-picture" : ""}`}
              style={picture ? { "--picture": `url("${convertFileSrc(picture)}")` } : undefined}
              onClick={() => onDayClick(date)}
            >
              <div className="cell-head">
                <span className="cell-number">{date.getDate()}</span>
                {holiday && (
                  <span className="cell-holiday" title={holiday.map(h => h.name).join(" · ")}>
                    {holiday.map(h => h.shortName).join(" · ")}
                  </span>
                )}
              </div>
              {dayAlarms.slice(0, MAX_VISIBLE_ALARMS).map(alarm => (
                <AlarmChip
                  key={alarm.id ?? alarm.time}
                  alarm={alarm}
                  onEdit={onEditAlarm}
                  onDelete={onDeleteAlarm}
                />
              ))}
              {hidden > 0 && (
                <button
                  className="cell-more"
                  onClick={(e) => { e.stopPropagation(); onShowDay(date); }}
                >
                  +{hidden} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
