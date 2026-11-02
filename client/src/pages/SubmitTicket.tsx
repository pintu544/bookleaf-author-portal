import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiFailure, type Book, type BooksResponse, type Ticket } from "../api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useToast } from "../components/ui/toast";

export default function SubmitTicket() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState<string>("general");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<BooksResponse>("/api/me/books").then((r) => setBooks(r.books)).catch(() => setBooks([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ ticket: Ticket }>("/api/me/tickets", {
        method: "POST",
        body: JSON.stringify({
          bookId: bookId === "general" ? null : bookId,
          subject: subject.trim(),
          description: description.trim(),
        }),
      });
      toast("Query submitted", "The BookLeaf team will reply on your ticket — it updates here automatically.");
      navigate(`/tickets/${res.ticket.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiFailure ? err.message : "We could not submit your query. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2 text-[15px] placeholder:text-ink-soft/70";

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Submit a Query</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
        Tell us what you need help with. The more specific you are — amounts, dates, where you saw the issue — the
        faster the team can resolve it.
      </p>

      <form onSubmit={submit} className="mt-5 rounded-xl border border-line bg-card p-6">
        <label className="block text-sm font-medium" htmlFor="book">
          This query is about
        </label>
        <Select value={bookId} onValueChange={setBookId}>
          <SelectTrigger id="book" className="mt-1.5 w-full py-2.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General / Account Level</SelectItem>
            {books.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="mt-5 block text-sm font-medium" htmlFor="subject">
          Subject
        </label>
        <input
          id="subject"
          required
          minLength={3}
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={field}
          placeholder="e.g. Royalty for the last quarter has not arrived"
        />

        <label className="mt-5 block text-sm font-medium" htmlFor="description">
          Details
        </label>
        <textarea
          id="description"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={field}
          placeholder="Describe the issue, with dates and amounts where you have them."
        />

        <label className="mt-5 block text-sm font-medium" htmlFor="attachment">
          Attachment <span className="font-normal text-ink-soft">(optional — for print issues, a photo of the defective copy helps)</span>
        </label>
        <input
          id="attachment"
          type="file"
          className="mt-1.5 block w-full text-sm text-ink-soft file:mr-3 file:rounded-md file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
          onChange={(e) => setAttachmentName(e.target.files?.[0]?.name ?? null)}
        />
        {attachmentName && <p className="mt-1 text-xs text-ink-soft">Selected: {attachmentName}</p>}

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-clay/10 px-3 py-2 text-sm text-clay">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 rounded-md bg-leaf px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-leaf-deep disabled:opacity-60"
        >
          {busy ? "Submitting…" : "Submit query"}
        </button>
      </form>
    </div>
  );
}
