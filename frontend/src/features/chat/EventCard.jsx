import Linkified from "../../shared/text/Linkified.jsx";

const formatWhen = (iso) => new Date(iso).toLocaleString([], {
  weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});

/*
What the assistant proposes, always behind a button: a new event (kind "add"), a change to one
(kind "edit") or removing one (kind "delete"). Nothing happens until the button is pressed.
card is {kind, proposal | change, done}; busy and error are only for this session.
*/
export default function EventCard({ card, busy, error, onRun }) {
  const { kind, done } = card;
  const item = kind === "add" ? card.proposal : card.change;

  const label = {
    add: { idle: "Add to calendar", busy: "Adding...", done: "Added to your calendar" },
    edit: { idle: "Save the change", busy: "Saving...", done: "Changed" },
    delete: { idle: "Delete this event", busy: "Deleting...", done: "Deleted" },
  }[kind];

  return (
    <div className="event-card">
      {kind === "add" && (
        <>
          <strong className="event-card-title">{item.title}</strong>
          <span className="event-card-when">{formatWhen(item.time)}</span>
          {item.notes?.length > 0 && (
            <ul className="event-card-notes">
              {item.notes.map((note, i) => <li key={i}><Linkified text={note} /></li>)}
            </ul>
          )}
        </>
      )}

      {kind === "edit" && (
        <>
          <span className="event-card-kind">Change an event</span>
          <strong className="event-card-title">{item.title}</strong>
          {item.newTitle && <span className="event-card-when">New title: {item.newTitle}</span>}
          {item.newTime ? (
            <>
              <span className="event-card-when event-card-old">Now: {formatWhen(item.time)}</span>
              <span className="event-card-when">New: {formatWhen(item.newTime)}</span>
            </>
          ) : (
            <span className="event-card-when">{formatWhen(item.time)}</span>
          )}
        </>
      )}

      {kind === "delete" && (
        <>
          <span className="event-card-kind">Remove an event</span>
          <strong className="event-card-title">{item.title}</strong>
          <span className="event-card-when">{formatWhen(item.time)}</span>
        </>
      )}

      {error && <p className="form-error">{error}</p>}
      <button
        className={`btn ${kind === "delete" ? "btn-danger" : "btn-primary"}`}
        disabled={done || busy}
        onClick={onRun}
      >
        {done ? label.done : busy ? label.busy : error ? "Try again" : label.idle}
      </button>
    </div>
  );
}
