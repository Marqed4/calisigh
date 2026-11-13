import { useEffect, useRef, useState } from "react";
import { Close } from "../../shared/components/Icons.jsx";
import { formatTime } from "../calendar/calendarUtils.js";
import { emptyFilters, isActive } from "./eventSearch.js";
import { formatTotals, sumAmounts } from "../../shared/text/money.js";
import "./EventSearch.css";

const MAX_RESULTS = 8;

/* Controlled by Home so the calendar views can highlight the same matches the list shows */
export default function EventSearch({ filters, onChange, matches, onPick }) {
  const [open, setOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const skipOpen = useRef(false);

  const active = isActive(filters);
  const totalText = formatTotals(sumAmounts(matches));
  const set = (patch) => { onChange({ ...filters, ...patch }); setOpen(true); };

  /* Ctrl + F or "/" jumps to the search box; clicking elsewhere closes the list */
  useEffect(() => {
    function onKeyDown(e) {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName);
      if ((e.ctrlKey && e.key.toLowerCase() === "f") || (!typing && e.key === "/")) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    function onPointerDown(e) {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  function pick(alarm) {
    onPick(new Date(alarm.time));
    setOpen(false);
  }

  function clear() {
    onChange(emptyFilters());
    setShowFilters(false);
    setOpen(false);
  }

  /* Arrow keys walk the result list; up from the first one goes back to the box */
  function onListKeyDown(e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(listRef.current?.querySelectorAll("button") ?? [])];
    const next = items.indexOf(document.activeElement) + (e.key === "ArrowDown" ? 1 : -1);
    if (next < 0) inputRef.current?.focus();
    else items[Math.min(next, items.length - 1)]?.focus();
  }

  /* Esc inside the filters or list closes the popup and keeps the search */
  function onPopKeyDown(e) {
    if (e.key !== "Escape") return;
    skipOpen.current = true;
    setOpen(false);
    inputRef.current?.focus();
  }

  function onInputKeyDown(e) {
    if (e.key === "Enter" && matches[0]) pick(matches[0]);
    else if (e.key === "ArrowDown" && listRef.current?.querySelector("button")) {
      e.preventDefault();
      listRef.current.querySelector("button").focus();
    }
    else if (e.key === "Escape") {
      clear();
      e.target.blur();
    }
  }

  return (
    <div className="event-search" ref={boxRef}>
      <input
        ref={inputRef}
        className="input event-search-input"
        type="text"
        value={filters.text}
        placeholder="Search events"
        aria-label="Search events"
        title="Search title, notes, time or date (Ctrl+F or /). Esc clears."
        onChange={(e) => set({ text: e.target.value })}
        onFocus={() => { if (skipOpen.current) skipOpen.current = false; else setOpen(true); }}
        onKeyDown={onInputKeyDown}
      />
      {active && (
        <button className="event-search-clear" aria-label="Clear search" onClick={clear}>
          <Close size={12} />
        </button>
      )}

      {open && (
        <div className="event-search-pop" onKeyDown={onPopKeyDown}>
          <div className="event-search-bar">
            <button className="event-search-toggle" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
              {showFilters ? "Hide filters" : "Filters"}
            </button>
            {active && (
              <span className="event-search-count" aria-live="polite">
                {matches.length} match{matches.length === 1 ? "" : "es"}{totalText && ` · ${totalText}`}
              </span>
            )}
          </div>

          {showFilters && (
            <div className="event-search-filters">
              <label>From
                <input className="input" type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
              </label>
              <label>To
                <input className="input" type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
              </label>
              <label>After
                <input className="input" type="time" value={filters.timeFrom} onChange={(e) => set({ timeFrom: e.target.value })} />
              </label>
              <label>Before
                <input className="input" type="time" value={filters.timeTo} onChange={(e) => set({ timeTo: e.target.value })} />
              </label>
            </div>
          )}

          {active && (
            <ul className="event-search-results" ref={listRef} onKeyDown={onListKeyDown}>
              {matches.length === 0 && <li className="event-search-empty">No events match</li>}
              {matches.slice(0, MAX_RESULTS).map((alarm) => (
                <li key={alarm.id ?? alarm.time}>
                  <button onClick={() => pick(alarm)}>
                    <span className="event-search-title">{alarm.title}</span>
                    <span className="event-search-when">
                      {new Date(alarm.time).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} · {formatTime(alarm.time)}
                    </span>
                  </button>
                </li>
              ))}
              {matches.length > MAX_RESULTS && (
                <li className="event-search-empty">+{matches.length - MAX_RESULTS} more, highlighted on the calendar</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
