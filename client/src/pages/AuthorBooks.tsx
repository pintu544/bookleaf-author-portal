import { useEffect, useState } from "react";
import { api, fmtDate, inr, type BooksResponse } from "../api";

export default function AuthorBooks() {
  const [data, setData] = useState<BooksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<BooksResponse>("/api/me/books")
      .then(setData)
      .catch(() => setError("We could not load your books just now. Please refresh the page."));
  }, []);

  if (error) return <p role="alert" className="rounded-md bg-clay/10 px-4 py-3 text-clay">{error}</p>;
  if (!data) return <p className="text-ink-soft">Loading your books…</p>;

  const s = data.summary;
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">My Books</h1>

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {[
          ["Books", String(s.bookCount)],
          ["Copies sold", s.totalCopiesSold.toLocaleString("en-IN")],
          ["Royalty earned", inr(s.totalRoyaltyEarned)],
          ["Royalty pending", inr(s.royaltyPending)],
        ].map(([label, value]) => (
          <div key={label} className="bg-card px-5 py-4">
            <dt className="text-[13px] font-medium text-ink-soft">{label}</dt>
            <dd className="tabular mt-1 text-xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-ink-soft">
        Royalties are calculated quarterly and paid within 45 days of the quarter ending, once your accumulated royalty
        crosses ₹1,000. Paid so far: <span className="tabular font-medium text-ink">{inr(s.royaltyPaid)}</span>.
      </p>

      <div className="mt-6 space-y-4">
        {data.books.map((b) => {
          const inProduction = b.status.startsWith("In Production");
          return (
            <article key={b.id} className="rounded-xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold leading-snug">{b.title}</h2>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {b.genre} · ISBN {b.isbn}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${inProduction ? "bg-gold/15 text-gold" : "bg-leaf/10 text-leaf"}`}
                >
                  {b.status}
                </span>
              </div>

              {inProduction ? (
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                  This book is still in production, so sales and royalty figures will appear here once it is published
                  and live. You can raise a query about its progress any time.
                </p>
              ) : (
                <dl className="tabular mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[15px] sm:grid-cols-3 lg:grid-cols-6">
                  <div>
                    <dt className="text-[13px] text-ink-soft">MRP</dt>
                    <dd className="font-medium">{b.mrp != null ? inr(b.mrp) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-ink-soft">Published</dt>
                    <dd className="font-medium">{fmtDate(b.publicationDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-ink-soft">Copies sold</dt>
                    <dd className="font-medium">{b.totalCopiesSold.toLocaleString("en-IN")}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-ink-soft">Royalty earned</dt>
                    <dd className="font-medium">{inr(b.totalRoyaltyEarned)}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-ink-soft">Royalty paid</dt>
                    <dd className="font-medium">{inr(b.royaltyPaid)}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-ink-soft">Royalty pending</dt>
                    <dd className="font-medium">{inr(b.royaltyPending)}</dd>
                  </div>
                </dl>
              )}

              <p className="mt-3 text-sm text-ink-soft">
                {b.availableOn.length > 0 && <>Available on {b.availableOn.join(", ")}. </>}
                {b.printPartner && <>Printed by {b.printPartner}. </>}
                {b.lastRoyaltyPayoutDate && <>Last royalty payout {fmtDate(b.lastRoyaltyPayoutDate)}.</>}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
