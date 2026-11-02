import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fmtDateTime, getSession, inr, type Book, type Ticket, type TicketMessage } from "../api";
import { priorityStyle, statusLabel, statusStyle } from "../components/Shell";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useToast } from "../components/ui/toast";
import { Tooltip } from "../components/ui/tooltip";

interface AdminTicket extends Ticket {
  author: { id: string; name: string; email: string; city: string; phone: string };
  book: Book | null;
  notes: { id: string; body: string; createdAt: string }[];
  aiDraft: string | null;
}

const CATEGORIES = [
  "Royalty & Payments",
  "ISBN & Metadata Issues",
  "Printing & Quality",
  "Distribution & Availability",
  "Book Status & Production Updates",
  "General Inquiry",
];

export default function AdminTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<AdminTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const { toast } = useToast();

  const load = useCallback(() => {
    if (!id) return;
    api<{ ticket: AdminTicket }>(`/api/admin/tickets/${id}`)
      .then((r) => setTicket(r.ticket))
      .catch(() => setError("We could not find that ticket."));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const session = getSession();
    if (!session || !id) return;
    const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
    const es = new EventSource(`${base}/api/admin/events?token=${encodeURIComponent(session.token)}`);
    const refresh = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { ticketId?: string };
        if (!data.ticketId || data.ticketId === id) load();
      } catch {
        load();
      }
    };
    es.addEventListener("ticket-updated", refresh);
    es.addEventListener("message-added", refresh);
    return () => es.close();
  }, [id, load]);

  async function patch(body: Record<string, unknown>) {
    if (!id) return;
    setBusy(true);
    try {
      await api(`/api/admin/tickets/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      toast("Ticket updated");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function generateDraft() {
    if (!id) return;
    setDraftBusy(true);
    try {
      const res = await api<{ draft: string }>(`/api/admin/tickets/${id}/draft`, { method: "POST" });
      setDraftText(res.draft);
      setDraftOpen(true);
    } catch {
      setError("The draft could not be generated just now. You can still write a reply manually.");
    } finally {
      setDraftBusy(false);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !reply.trim()) return;
    setBusy(true);
    try {
      await api(`/api/admin/tickets/${id}/replies`, { method: "POST", body: JSON.stringify({ body: reply.trim() }) });
      toast("Reply sent", "The author can see it on their ticket now.");
      setReply("");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !note.trim()) return;
    setBusy(true);
    try {
      await api(`/api/admin/tickets/${id}/notes`, { method: "POST", body: JSON.stringify({ body: note.trim() }) });
      toast("Internal note added", "Only the support team can see it.");
      setNote("");
      load();
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p role="alert" className="rounded-md bg-clay/10 px-4 py-3 text-clay">{error}</p>;
  if (!ticket) return <p className="text-ink-soft">Loading the ticket…</p>;

  const book = ticket.book;

  return (
    <div>
      <Link to="/admin" className="text-sm font-medium text-leaf hover:underline">
        ← Back to the queue
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle(ticket.status)}`}>
              {statusLabel(ticket.status)}
            </span>
            {ticket.priority && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityStyle(ticket.priority)}`}>
                {ticket.priority.charAt(0) + ticket.priority.slice(1).toLowerCase()}
                {ticket.prioritySource === "ADMIN" ? " · overridden" : ""}
              </span>
            )}
            <Tooltip
              label={
                ticket.categorySource === "ADMIN"
                  ? "A support team member set this, overriding the AI's call"
                  : ticket.categorySource === "FALLBACK"
                    ? "Assigned by the deterministic rules engine because the AI was unavailable"
                    : "Classified automatically by AI when the ticket arrived; the team can override it"
              }
            >
              <span className="cursor-default text-xs font-medium text-ink-soft">
                {ticket.category ?? "Awaiting classification"}
                {ticket.categorySource === "ADMIN" ? " · overridden" : ticket.categorySource === "FALLBACK" ? " · auto (rules)" : ticket.category ? " · by AI" : ""}
              </span>
            </Tooltip>
          </div>
          <h1 className="mt-2 font-display text-2xl font-semibold leading-snug tracking-tight">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {ticket.author.name} · {ticket.author.email} · {ticket.author.city} · opened {fmtDateTime(ticket.createdAt)}
          </p>

          <ol className="mt-6 space-y-4">
            {ticket.messages.map((m: TicketMessage) => (
              <li
                key={m.id}
                className={`rounded-xl border p-4 ${m.senderRole === "ADMIN" ? "border-leaf/30 bg-leaf/5" : "border-line bg-card"}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {m.senderRole === "ADMIN" ? "BookLeaf Support" : ticket.author.name} · {fmtDateTime(m.createdAt)}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed">{m.body}</p>
              </li>
            ))}
          </ol>

          <form onSubmit={sendReply} className="mt-6 rounded-xl border border-line bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-semibold" htmlFor="reply">
                Reply to {ticket.author.name.split(" ")[0]}
              </label>
              <button
                type="button"
                onClick={generateDraft}
                disabled={draftBusy}
                className="rounded-md border border-leaf px-3 py-1.5 text-sm font-medium text-leaf hover:bg-leaf/5 disabled:opacity-60"
              >
                {draftBusy ? "Drafting…" : "Generate AI draft"}
              </button>
            </div>
            <textarea
              id="reply"
              rows={7}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-[15px] leading-relaxed"
              placeholder="Write the response in BookLeaf's voice: specific, warm, and with a clear next step."
            />
            <button
              type="submit"
              disabled={busy || !reply.trim()}
              className="mt-3 rounded-md bg-leaf px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-leaf-deep disabled:opacity-60"
            >
              Send reply
            </button>
          </form>

          <form onSubmit={addNote} className="mt-4 rounded-xl border border-dashed border-line bg-paper p-5">
            <label className="text-sm font-semibold" htmlFor="note">
              Internal note <span className="font-normal text-ink-soft">— never visible to the author</span>
            </label>
            <textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-[15px]"
              placeholder="e.g. Escalated to the production team, ref…"
            />
            <button
              type="submit"
              disabled={busy || !note.trim()}
              className="mt-3 rounded-md border border-line px-4 py-2 text-sm font-semibold hover:bg-paper-deep disabled:opacity-60"
            >
              Add note
            </button>
            {ticket.notes.length > 0 && (
              <ul className="mt-4 space-y-3">
                {ticket.notes.map((n) => (
                  <li key={n.id} className="rounded-md bg-paper-deep px-3 py-2">
                    <p className="text-xs text-ink-soft">{fmtDateTime(n.createdAt)}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </form>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-line bg-card p-5">
            <h2 className="text-sm font-semibold">Manage</h2>
            <label className="mt-3 block text-[13px] font-medium text-ink-soft" id="status-label">
              Status
            </label>
            <Select value={ticket.status} disabled={busy} onValueChange={(v) => patch({ status: v })}>
              <SelectTrigger aria-labelledby="status-label" className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
            <label className="mt-3 block text-[13px] font-medium text-ink-soft" id="category-label">
              Category
            </label>
            <Select
              value={ticket.category ?? "unset"}
              disabled={busy}
              onValueChange={(v) => v !== "unset" && patch({ category: v })}
            >
              <SelectTrigger aria-labelledby="category-label" className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Unclassified</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="mt-3 block text-[13px] font-medium text-ink-soft" id="priority-label">
              Priority
            </label>
            <Select
              value={ticket.priority ?? "unset"}
              disabled={busy}
              onValueChange={(v) => v !== "unset" && patch({ priority: v })}
            >
              <SelectTrigger aria-labelledby="priority-label" className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Unset</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              disabled={busy}
              onClick={() => patch({ assignedToMe: true })}
              className="mt-4 w-full rounded-md border border-line px-4 py-2 text-sm font-semibold hover:bg-paper-deep disabled:opacity-60"
            >
              {ticket.assignedToId ? "Assigned — reassign to me" : "Assign to me"}
            </button>
          </section>

          {book && (
            <section className="rounded-xl border border-line bg-card p-5">
              <h2 className="text-sm font-semibold">Book context</h2>
              <p className="mt-2 font-display text-[17px] font-semibold leading-snug">{book.title}</p>
              <p className="text-sm text-ink-soft">
                {book.genre} · ISBN {book.isbn}
              </p>
              <dl className="tabular mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-soft">Status</dt><dd className="font-medium">{book.status}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Copies sold</dt><dd className="font-medium">{book.totalCopiesSold.toLocaleString("en-IN")}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Royalty earned</dt><dd className="font-medium">{inr(book.totalRoyaltyEarned)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Royalty paid</dt><dd className="font-medium">{inr(book.royaltyPaid)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Royalty pending</dt><dd className="font-medium">{inr(book.royaltyPending)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Print partner</dt><dd className="font-medium">{book.printPartner ?? "—"}</dd></div>
              </dl>
            </section>
          )}
        </aside>
      </div>

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent
          title="Review the AI draft"
          description="Grounded in BookLeaf's Knowledge Base and this author's real figures. Edit it freely — nothing is sent until you put it in the reply and send it yourself."
        >
          <textarea
            rows={12}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-[15px] leading-relaxed"
            aria-label="AI draft text"
          />
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setDraftOpen(false)}
              className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:bg-paper-deep"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={draftBusy}
              onClick={generateDraft}
              className="rounded-md border border-leaf px-4 py-2 text-sm font-semibold text-leaf hover:bg-leaf/5 disabled:opacity-60"
            >
              {draftBusy ? "Drafting…" : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={() => {
                setReply(draftText);
                setDraftOpen(false);
                toast("Draft placed in the reply box", "Give it a final read before sending.");
              }}
              className="rounded-md bg-leaf px-4 py-2 text-sm font-semibold text-white hover:bg-leaf-deep"
            >
              Use this draft
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
