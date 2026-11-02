# BookLeaf Author Support & Communication Portal

A full-stack support portal for BookLeaf Publishing, built for the BookLeaf Full Stack Developer technical assignment (Nov 2026). Authors check their books and royalties and raise support queries; the BookLeaf team works a live ticket queue where every ticket is auto-classified and prioritised by AI, and every reply starts from an AI draft grounded in the author's real numbers and BookLeaf's own policies.

## Live demo

- **App:** https://bookleaf-portal-jade.vercel.app
- **API:** https://bookleaf-portal-api.azurewebsites.net (health: `/health`)
- **Test credentials** (seeded from the exact dataset provided with the brief):

| Role | Email | Password |
|---|---|---|
| Author | priya.sharma@email.com (any of the 10 dataset authors) | `bookleaf123` |
| Admin | admin@bookleafpub.com | `admin123` |

## What it does

**Author portal**
- Login (email/password, JWT); authors can only ever see their own data — scoping is enforced from the token on every route, and another author's ticket reads as a plain 404.
- **My Books** — every dataset field (title, ISBN, genre, publication date, status, MRP, copies sold, royalty earned / paid / pending, last payout, print partner, platforms), plus a plain-language explainer of the quarterly payout cycle and the ₹1,000 threshold. In-production books (whose MRP and per-copy royalty are genuinely null in the dataset) show a production note instead of invented figures.
- **Submit Query** — book dropdown or "General / Account Level", subject, description, optional attachment field.
- **My Tickets** — status (Open / In Progress / Resolved / Closed), the full thread, and near-real-time updates (SSE push with a polling baseline, so a reply appears without refreshing).

**Admin portal**
- **Ticket Queue** — filterable by status, category, priority and date; sorted urgent-first, then oldest-unresolved, so the tickets that matter surface without hunting.
- **Ticket Workspace** — full thread with the author's book context alongside; status lifecycle; **override the AI's category/priority** (recorded as a human override, never silently rewritten); assign to me; internal notes that are structurally invisible to authors (the author serializer never includes them, and a test proves it); reply box with **Generate AI draft** — the draft is grounded in the Knowledge Base plus the ticket's real figures, is cached on the ticket, and is always edited by a human before sending.

**API** — REST with consistent plural resources, auth middleware, role-based access control, zod validation on every input, and one error shape everywhere: `{ "error": { "code", "message", "details?" } }` with meaningful HTTP statuses (401 unauthenticated, 403 wrong role, 404 hidden-or-missing, 422 invalid input).

## Architecture

```
client/  React 18 + Vite + TypeScript + Tailwind CSS 4   (author + admin SPAs, one build)
server/  Node + Express + TypeScript, Prisma ORM
         SQLite locally (zero-config) → PostgreSQL in production via DATABASE_URL
         JWT auth (bcrypt password hashing), SSE hub for live updates
         AI service: LLM provider ⇄ deterministic fallback engine, one interface
```

- **One repo, two packages**, deployed independently: the client is a static build; the API is a small Node service. CORS is configured by an origin allowlist.
- **Data model** — `User` (login identity + role) is separate from `Author` (the dataset's author record), so an admin account needs no author row and an author's data access is derived from the JWT, never from a client-supplied id. Tickets carry `categorySource` / `prioritySource` (`AI` | `FALLBACK` | `ADMIN`) so it is always visible whether a value came from the model, the rules engine, or a human override, plus a cached `aiDraft`.
- **Real-time** — an in-process SSE hub with per-author and per-admin channels; events are published on ticket create/update/reply. The client also polls as a baseline, so the experience degrades gracefully through proxies that kill long-lived connections. In a multi-instance deployment the hub swaps for Redis pub/sub behind the same publish/subscribe calls.
- **Seed** — `server/prisma/seed.ts` loads the provided `bookleaf_sample_data.json` verbatim (10 authors, 18 books) and creates the demo logins above. It is idempotent.

## AI integration

Two tasks, two models, chosen by measurement rather than habit. I ran a bake-off over the brief's own seven sample queries plus a draft built on a real author's figures, across the Vercel AI Gateway, FastRouter and direct OpenAI (gpt-4o-mini, Claude Haiku 4.5, Gemini 2.5 Flash, Llama 4 Scout):

- **Classification + priority → gpt-4o-mini.** Tied-best accuracy (its only miss, like every model's, was the genuinely ambiguous description-update case), the cleanest bare-JSON output, ~1.5 s, ~$0.000036 per ticket.
- **Draft replies → Claude Haiku 4.5.** Best tone and structure, and the only draft that included the bank-details confirmation the brief's own expected response asks for; ~$0.0018 per draft, generated once and cached per ticket. (The gateway's free tier cannot serve Haiku — 403 — so drafts route via FastRouter, which also serves the classification model; the whole AI layer is env-config, so repointing either task is a one-line change.)
- **Rejected:** Gemini 2.5 Flash spent most of its token budget on reasoning tokens at cost-conscious settings — 5 of 7 classifications truncated, the draft came back a stub, at ~20× gpt-4o-mini's cost.

**Prompt strategy.** Classification is a constrained prompt: the exact six categories, the brief's priority criteria verbatim, JSON-only output, and the response is validated against the taxonomy — any off-taxonomy or malformed answer is discarded, never stored. Drafts are grounded in a single Knowledge Base module (royalty maths and quarterly/45-day cycle, ₹1,000 threshold, ISBN escalation, print turnaround and free-reprint rule, distribution windows and re-sync, the nine production stages, and BookLeaf's tone rules) plus the ticket's real figures injected as context. The brief's sample drafts set the shape: acknowledge first, be specific, own faults, give a timeline, end with one next step.

**Graceful degradation.** Every AI call has a 12-second timeout and fails closed into a **deterministic fallback engine** — keyword classification, rule-based priority that mirrors the brief's criteria (it scores 7/7 on the brief's own samples, including Critical for the six-months-unpaid case and High for the ISBN error), and template drafts assembled from the same Knowledge Base and the author's actual figures. With no API key configured at all, the portal still classifies, prioritises and drafts; the queue simply labels those values as rules-based.

**Cost awareness.** Classification is a ~200-token call on a mini-class model (~$0.00004); drafts are the only larger call (~$0.002) and are cached per ticket instead of regenerated. Providers report per-call cost in their usage object, which the server logs. At BookLeaf's stated 1,200+ books/month scale, even a few thousand tickets a month keeps the AI bill in single-digit dollars.

## Run it locally

```bash
# server (terminal 1)
cd server
cp .env.example .env        # set JWT_SECRET; AI keys optional (fallback engine covers you)
npm install
npx prisma generate
npx prisma db push
npm run seed                # loads the provided dataset + demo logins
npm run dev                 # API on http://localhost:4000

# client (terminal 2)
cd client
npm install
npm run dev                 # app on http://localhost:5173 (proxies /api to :4000)
```

**Tests** (34, all green): `cd server && npm test` — auth and role enforcement, author scoping (including cross-author book rejection and hidden tickets), the full admin lifecycle, internal-note privacy, fallback classification against the brief's seven samples, draft grounding in real figures, and LLM output parsing.

**API summary** — `POST /api/auth/login`, `GET /api/auth/me`; `GET /api/me/profile`, `GET /api/me/books`; `POST|GET /api/me/tickets`, `GET /api/me/tickets/:id`, `GET /api/me/events` (SSE); `GET /api/admin/tickets` (filters: `status`, `category`, `priority`, `from`, `to`), `GET|PATCH /api/admin/tickets/:id`, `POST /api/admin/tickets/:id/replies`, `POST /api/admin/tickets/:id/notes`, `POST /api/admin/tickets/:id/draft`, `GET /api/admin/events` (SSE).

## Limitations and what I would do next

- Attachments are UI-only in this build (the brief allows this); production would add object storage with virus scanning and signed URLs.
- The SSE hub is in-process (single instance); Redis pub/sub is the documented next step, along with ticket search, SLA timers and breach alerts on the queue, and an author-side follow-up message composer (authors currently start a new ticket to reopen a topic).
- Password reset and email verification are out of scope for the assignment window; the auth layer is shaped so both slot into the existing middleware.
- The classification prompt could add few-shot examples for the one ambiguous case the bake-off found (profile/description updates that read as metadata but file as General Inquiry).
