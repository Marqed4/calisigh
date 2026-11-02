import { Plus } from "./Icons.jsx";
import { AlarmChip } from "./CalendarGrid.jsx";
import { WEEKDAYS_SHORT, alarmsOn, dateKey, getWeekDays, isSameDay } from "../lib/calendarUtils.js";
import "./WeekView.css";

export default function WeekView({ currentDate, alarms, holidays = {}, onDayClick, onEditAlarm, onDeleteAlarm, onBookmarkAlarm }) {
  const today = new Date();
  const days = getWeekDays(currentDate);

  return (
    <div className="week-view">
      {days.map(date => {
        const isToday = isSameDay(date, today);
        const holiday = holidays[dateKey(date)];
        const dayAlarms = alarmsOn(alarms, date);

        return (
          <section
            key={date.getTime()}
            className={`week-col${isToday ? " week-col-today" : ""}`}
            onClick={() => onDayClick(date)}
          >
            <header className="week-col-head">
              <span className="week-col-name">{WEEKDAYS_SHORT[date.getDay()]}</span>
              <span className="week-col-number">{date.getDate()}</span>
              {holiday && (
                <span className="week-col-holiday" title={holiday.map(h => h.name).join(" · ")}>
                  {holiday.map(h => h.name).join(" · ")}
                </span>
              )}
            </header>
            <div className="week-col-body">
              {dayAlarms.length === 0 && <p className="week-empty">Nothing planned</p>}
              {dayAlarms.map(alarm => (
                <AlarmChip
                  key={alarm.id ?? alarm.time}
                  alarm={alarm}
                  onEdit={onEditAlarm}
                  onDelete={onDeleteAlarm}
                  onBookmark={onBookmarkAlarm}
                />
              ))}
            </div>
            <button
              className="week-add"
              aria-label={`Add alarm on ${date.toDateString()}`}
              onClick={(e) => { e.stopPropagation(); onDayClick(date); }}
            >
              <Plus size={14} /> Add
            </button>
          </section>
        );
      })}
    </div>
  );
}
