import { dateKey, getMonthCells, isSameDay, weekdaysShort } from "./calendarUtils.js";
import "./ViewYears.css";

function MiniMonth({ year, month, alarmDays, onSelect }) {
  const today = new Date();
  const cells = getMonthCells(new Date(year, month, 1));
  const name = new Date(year, month, 1).toLocaleString("default", { month: "long" });

  return (
    <button className="year-month" onClick={() => onSelect(month)} aria-label={`${name} ${year}`}>
      <span className="year-month-name">{name}</span>
      <div className="year-month-grid">
        {weekdaysShort().map(d => <span key={d} className="year-month-dow">{d[0]}</span>)}
        {cells.map(date => {
          const outside = date.getMonth() !== month;
          if (outside) return <span key={date.getTime()} />;
          const cls = ["year-day"];
          if (isSameDay(date, today)) cls.push("year-day-today");
          if (alarmDays.has(dateKey(date))) cls.push("year-day-alarm");
          return <span key={date.getTime()} className={cls.join(" ")}>{date.getDate()}</span>;
        })}
      </div>
    </button>
  );
}

export default function ViewYears({ currentDate, alarms = [], onSelectMonth }) {
  const year = currentDate.getFullYear();
  const alarmDays = new Set(alarms.map(a => a.time?.slice(0, 10)));

  return (
    <div className="year-view">
      {Array.from({ length: 12 }, (_, m) => (
        <MiniMonth key={m} year={year} month={m} alarmDays={alarmDays} onSelect={mo => onSelectMonth(year, mo)} />
      ))}
    </div>
  );
}