import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fmtDateTime, type Ticket } from "../api";
import { priorityStyle, statusLabel, statusStyle } from "../components/Shell";

export default function AuthorTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    api<{ ticket: Ticket }>(`/api/me/tickets/${id}`)
      .then((r) => setTicket(r.ticket))
      .catch(() => setError("We could not find that ticket."));
  }, [id]);

  useEffect(() => {
    load();
    // Near-real-time: poll quietly so an admin reply appears without a
    // manual refresh (the server also offers an SSE stream; polling is the
    // resilient baseline that works through every proxy).
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  if (error) return <p role="alert" className="rounded-md bg-clay/10 px-4 py-3 text-clay">{error}</p>;
  if (!ticket) return <p className="text-ink-soft">Loading your ticket…</p>;

  return (
    <div className="max-w-3xl">
      <Link to="/tickets" className="text-sm font-medium text-leaf hover:underline">
        ← All my tickets
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle(ticket.status)}`}>
          {statusLabel(ticket.status)}
        </span>
        {ticket.priority && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityStyle(ticket.priority)}`}>
            {ticket.priority.charAt(0) + ticket.priority.slice(1).toLowerCase()} priority
          </span>
        )}
        {ticket.category && <span className="text-xs font-medium text-ink-soft">{ticket.category}</span>}
      </div>
      <h1 className="mt-2 font-display text-2xl font-semibold leading-snug tracking-tight">{ticket.subject}</h1>
      {ticket.book && <p className="mt-1 text-sm text-ink-soft">About: {ticket.book.title}</p>}

      <ol className="mt-6 space-y-4">
        {ticket.messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-xl border p-4 ${
              m.senderRole === "ADMIN" ? "border-leaf/30 bg-leaf/5" : "border-line bg-card"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {m.senderRole === "ADMIN" ? "BookLeaf Support" : "You"} · {fmtDateTime(m.createdAt)}
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed">{m.body}</p>
          </li>
        ))}
      </ol>

      {(ticket.status === "RESOLVED" || ticket.status === "CLOSED") && (
        <p className="mt-5 rounded-md bg-paper-deep px-4 py-3 text-sm leading-relaxed text-ink-soft">
          This ticket is marked {statusLabel(ticket.status).toLowerCase()}. If the issue is still not sorted, submit a
          new query and mention this one — the team will pick it up from there.
        </p>
      )}
    </div>
  );
}
