import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDateTime, type Ticket } from "../api";
import { priorityStyle, statusLabel, statusStyle } from "../components/Shell";

export default function AuthorTickets() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const load = () =>
      api<{ tickets: Ticket[] }>("/api/me/tickets")
        .then((r) => {
          if (!stop) setTickets(r.tickets);
        })
        .catch(() => {
          if (!stop) setError("We could not load your tickets just now. Please refresh the page.");
        });
    load();
    // Near-real-time refresh; SSE takes over in the ticket detail view and
    // this poll keeps the list fresh without a manual reload.
    const t = setInterval(load, 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  if (error) return <p role="alert" className="rounded-md bg-clay/10 px-4 py-3 text-clay">{error}</p>;
  if (!tickets) return <p className="text-ink-soft">Loading your tickets…</p>;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">My Tickets</h1>
        <Link to="/tickets/new" className="rounded-md bg-leaf px-4 py-2 text-sm font-semibold text-white hover:bg-leaf-deep">
          Submit a query
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="mt-6 rounded-xl border border-line bg-card p-6">
          <p className="text-[15px] leading-relaxed">
            You have not raised any queries yet. If anything about your books, royalties, ISBN or printing needs a
            second look, submit a query and the BookLeaf team will pick it up here.
          </p>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-line rounded-xl border border-line bg-card">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link to={`/tickets/${t.id}`} className="block px-5 py-4 hover:bg-paper">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle(t.status)}`}>
                    {statusLabel(t.status)}
                  </span>
                  {t.priority && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityStyle(t.priority)}`}>
                      {t.priority.charAt(0) + t.priority.slice(1).toLowerCase()}
                    </span>
                  )}
                  {t.category && <span className="text-xs font-medium text-ink-soft">{t.category}</span>}
                  <span className="ml-auto text-xs text-ink-soft">{fmtDateTime(t.createdAt)}</span>
                </div>
                <p className="mt-1.5 font-medium leading-snug">{t.subject}</p>
                <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-ink-soft">{t.messages[0]?.body}</p>
                {t.book && <p className="mt-1 text-xs text-ink-soft">About: {t.book.title}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
