/* An event the assistant proposes, with the things to keep in mind, and one button to add it */
export default function EventCard({ proposal, added, onAdd }) {
  const when = new Date(proposal.time).toLocaleString([], {
    weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  return (
    <div className="event-card">
      <strong className="event-card-title">{proposal.title}</strong>
      <span className="event-card-when">{when}</span>
      {proposal.notes?.length > 0 && (
        <ul className="event-card-notes">
          {proposal.notes.map((note, i) => <li key={i}>{note}</li>)}
        </ul>
      )}
      <button className="btn btn-primary" disabled={added} onClick={onAdd}>
        {added ? "Added to your calendar" : "Add to calendar"}
      </button>
    </div>
  );
}
