# PRODUCT.md — BookLeaf Author Support & Communication Portal

_Inferred from the explicit assignment brief (BookLeaf Publishing, Nov 2026); assumptions labelled._

## Users

1. **Authors** — self-published writers (India + US), mostly non-technical, often anxious about money and timelines. They come to check royalties and book status, and to get a straight answer fast. Mobile use is plausible; clarity beats density.
2. **BookLeaf ops admins** — a small internal team clearing a high-volume ticket queue (1,200+ books/month). They live in the queue all day: scanability, filters, and one-click drafts matter more than decoration.

## Jobs

- Author: "What is my book doing and what am I owed?" answered in one glance; raising a query takes under a minute; replies arrive without refreshing.
- Admin: triage the queue by urgency, trust-but-verify the AI's category/priority/draft, respond in BookLeaf's voice with the author's real numbers, keep internal notes private.

## Voice of the product

BookLeaf's own tone guidelines govern all copy: empathetic and professional, authors are partners, be specific (numbers, dates, statuses), own mistakes directly, always end with a clear next step. UI copy follows the same rules — no corporate deflection, no vague reassurance.

## Surfaces (mode: Operate)

- Author portal: login, My Books, Submit Query, My Tickets (live thread).
- Admin portal: Ticket Queue (filterable), Ticket Workspace (thread, AI draft, internal notes).
- Shared: one design system, role-based entry after login.

## Assumptions (labelled)

- English UI; ₹ formatting for royalties (dataset is INR).
- Demo credentials exist for reviewers, so the login screen should surface them gracefully in the README, not in the UI itself.
- Attachment upload is UI-only per the brief.
