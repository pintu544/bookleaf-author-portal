import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDateTime, getSession } from "../api";
import { priorityStyle, statusLabel, statusStyle } from "../components/Shell";

interface QueueTicket {
  id: string;
  subject: string;
  status: string;
  category: string | null;
  priority: string | null;
  createdAt: string;
  author: { id: string; name: string; email: string; city: string };
  book: { id: string; title: string } | null;
  _count: { messages: number; notes: number };
}

const CATEGORIES = [
  "Royalty & Payments",
  "ISBN & Metadata Issues",
  "Printing & Quality",
  "Distribution & Availability",
  "Book Status & Production Updates",
  "General Inquiry",
];

export default function AdminQueue() {
  const [tickets, setTickets] = useState<QueueTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (priority) params.set("priority", priority);
    api<{ tickets: QueueTicket[] }>(`/api/admin/tickets?${params.toString()}`)
      .then((r) => setTickets(r.tickets))
      .catch(() => setError("We could not load the queue just now."));
  }, [status, category, priority]);

  useEffect(() => {
    load();
  }, [load]);

  // Live queue: SSE nudges a reload whenever any ticket changes.
  useEffect(() => {
    const session = getSession();
    if (!session) return;
    const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
    const es = new EventSource(`${base}/api/admin/events?token=${encodeURIComponent(session.token)}`);
    const refresh = () => load();
    es.addEventListener("ticket-created", refresh);
    es.addEventListener("ticket-updated", refresh);
    es.addEventListener("message-added", refresh);
    return () => es.close();
  }, [load]);

  const selectCls = "rounded-md border border-line bg-white px-3 py-2 text-sm";

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Ticket Queue</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Urgent and longest-waiting tickets come first. AI categories and priorities can be overridden inside any
        ticket.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <select aria-label="Filter by status" className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select aria-label="Filter by category" className={selectCls} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select aria-label="Filter by priority" className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-clay/10 px-4 py-3 text-clay">
          {error}
        </p>
      )}
      {!tickets && !error && <p className="mt-4 text-ink-soft">Loading the queue…</p>}
      {tickets && tickets.length === 0 && (
        <p className="mt-6 rounded-xl border border-line bg-card p-6 text-[15px]">
          No tickets match these filters. The queue is clear on this view.
        </p>
      )}
      {tickets && tickets.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-card">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link to={`/admin/tickets/${t.id}`} className="block px-5 py-4 hover:bg-paper">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle(t.status)}`}>
                    {statusLabel(t.status)}
                  </span>
                  {t.priority && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityStyle(t.priority)}`}>
                      {t.priority.charAt(0) + t.priority.slice(1).toLowerCase()}
                    </span>
                  )}
                  <span className="text-xs font-medium text-ink-soft">{t.category ?? "Awaiting classification"}</span>
                  <span className="ml-auto text-xs text-ink-soft">{fmtDateTime(t.createdAt)}</span>
                </div>
                <p className="mt-1.5 font-medium leading-snug">{t.subject}</p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {t.author.name} · {t.author.city}
                  {t.book ? ` · ${t.book.title}` : " · General / Account Level"} · {t._count.messages} message
                  {t._count.messages === 1 ? "" : "s"}
                  {t._count.notes > 0 ? ` · ${t._count.notes} internal note${t._count.notes === 1 ? "" : "s"}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
