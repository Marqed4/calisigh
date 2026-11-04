import { convertFileSrc } from "@tauri-apps/api/core";
import { Close, Star } from "../../shared/components/Icons.jsx";
import Money from "../../shared/text/Money.jsx";
import { presetStyle } from "../presets/presets.js";
import { randomPattern, renderPattern } from "./asciiPatterns.js";
import { alarmsOn, dateKey, formatTime, getMonthCells, isSameDay, weekdaysShort } from "./calendarUtils.js";
import { matchKey } from "../search/eventSearch.js";
import "./CalendarGrid.css";

/* Chips shown per cell before "+N more" */
const MAX_VISIBLE_ALARMS = 2;

/* Picked once per launch: the ASCII art behind today's cell */
const TODAY_ART = renderPattern(randomPattern().tile);

export function AlarmChip({ alarm, matched, dimmed, onEdit, onDelete, onBookmark }) {
  const style = {
    ...presetStyle(alarm.preset),
    ...(alarm.image && { "--picture": `url("${convertFileSrc(alarm.image)}")` }),
  };

  return (
    <div
      className={`chip${alarm.image ? " chip-picture" : ""}${alarm.bookmarked ? " chip-bookmarked" : ""}${matched ? " chip-match" : ""}${dimmed ? " chip-dim" : ""}`}
      style={style}
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
      <span className="chip-title"><Money text={alarm.title} /></span>
      <button
        className="chip-star"
        aria-label={alarm.bookmarked ? `Remove bookmark from ${alarm.title}` : `Bookmark ${alarm.title}`}
        aria-pressed={alarm.bookmarked}
        title={alarm.bookmarked ? "Remove bookmark" : "Bookmark"}
        onClick={(e) => { e.stopPropagation(); onBookmark(alarm); }}
      >
        <Star size={12} filled={alarm.bookmarked} />
      </button>
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

export default function CalendarGrid({ currentDate, alarms, holidays = {}, onDayClick, onEditAlarm, onDeleteAlarm, onBookmarkAlarm, onShowDay, matchedKeys, searching }) {
  const today = new Date();
  const cells = getMonthCells(currentDate);

  return (
    <div className="month-view">
      <div className="month-weekdays">
        {weekdaysShort().map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="month-grid">
        {cells.map(date => {
          const outside = date.getMonth() !== currentDate.getMonth();
          const isToday = isSameDay(date, today);
          const holiday = holidays[dateKey(date)];
          const isMatch = (a) => Boolean(searching && matchedKeys?.has(matchKey(a)));
          /* While searching, matches go first so they are never hidden behind "+N more" (stable sort keeps time order) */
          const dayAlarms = alarmsOn(alarms, date).sort((a, b) => isMatch(b) - isMatch(a));
          const hidden = dayAlarms.length - MAX_VISIBLE_ALARMS;
          const dayHasMatch = dayAlarms.some(isMatch);
          const hiddenHasMatch = dayAlarms.slice(MAX_VISIBLE_ALARMS).some(isMatch);

          return (
            <div
              key={date.getTime()}
              className={`cell${outside ? " cell-outside" : ""}${isToday ? " cell-today" : ""}${dayHasMatch ? " cell-match" : ""}`}
              onClick={() => onDayClick(date)}
            >
              {isToday && <pre className="cell-ascii" aria-hidden="true">{TODAY_ART}</pre>}
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
                  matched={isMatch(alarm)}
                  dimmed={searching && !isMatch(alarm)}
                  onEdit={onEditAlarm}
                  onDelete={onDeleteAlarm}
                  onBookmark={onBookmarkAlarm}
                />
              ))}
              {hidden > 0 && (
                <button
                  className={`cell-more${hiddenHasMatch ? " cell-more-match" : ""}`}
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