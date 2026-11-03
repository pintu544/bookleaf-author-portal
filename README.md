# BookLeaf Author Support and Communication Portal

This is my submission for the BookLeaf Publishing full stack developer assignment. It is a support portal with two sides. Authors log in, see their books and royalty numbers, and raise queries. The BookLeaf team works through those queries in an admin queue where each ticket gets classified and prioritised automatically, and each reply starts as a draft written from the author's own figures and BookLeaf's policies, which the admin edits before sending.

## Live demo

- App: https://bookleaf-portal-jade.vercel.app
- API: https://bookleaf-portal-api.azurewebsites.net (health check at `/health`)

Test accounts, seeded from the dataset that came with the brief:

| Role | Email | Password |
|---|---|---|
| Author | priya.sharma@email.com (any of the 10 authors in the dataset works) | `bookleaf123` |
| Admin | admin@bookleafpub.com | `admin123` |

## What authors get

Login is email and password with a JWT. An author only ever sees their own data. The scoping comes from the token on every route, and if an author somehow opens another author's ticket id, the API answers 404, the same as if it did not exist.

My Books shows every field from the dataset: title, ISBN, genre, publication date, status, MRP, copies sold, royalty earned, paid and pending, last payout date, print partner and the platforms the book sells on. Under the summary there is a short note explaining how royalties work, calculated quarterly, paid within 45 days of the quarter ending, and only once the balance crosses ₹1,000. Two books in the dataset are still in production and have no MRP or per copy royalty yet. The page says that plainly instead of showing a made up number.

Submit Query has a dropdown of the author's books plus a General / Account Level option, a subject, a description and an optional attachment field. My Tickets lists the author's queries with their status (Open, In Progress, Resolved, Closed) and the full conversation. Replies from the admin show up without a refresh. The page uses server sent events, with a plain polling fallback underneath for networks that kill long lived connections.

## What the admin team gets

The queue filters by status, category, priority and date. It sorts urgent tickets first, then the ones that have been waiting longest, because in a real support queue those are the two things that decide what gets picked up next.

Inside a ticket, the admin sees the conversation next to the author's book record, so the numbers are on screen while replying. They can change the status, assign the ticket to themselves, and override the AI's category or priority. An override is recorded as a human decision in the data, with the source shown in the UI, rather than silently replacing what the AI said. Internal notes sit in the same screen but are never sent to the author's side of the API at all. There is a test that proves an author's response cannot contain a note.

Opening a ticket presents its AI draft, as the brief asks: a draft already generated for the ticket is loaded straight into the reply box, and a ticket without one gets a draft generated on open and shown in a review dialog. Either way the admin can read it, edit it, regenerate it, or write their own. Nothing is ever sent without a person pressing send.

## The API

The API is REST, with auth middleware and role checks on every route, zod validation on every input, and one error format everywhere:

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Email or password is incorrect" } }
```

Status codes mean what they should: 401 when there is no valid login, 403 when the role is wrong, 404 when a resource is missing or belongs to someone else, 422 when the input fails validation.

Endpoints: `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/me/profile`, `GET /api/me/books`, `POST` and `GET /api/me/tickets`, `GET /api/me/tickets/:id`, `GET /api/me/events` for the author's event stream, and on the admin side `GET /api/admin/tickets` (with `status`, `category`, `priority`, `from` and `to` filters), `GET` and `PATCH /api/admin/tickets/:id`, `POST /api/admin/tickets/:id/replies`, `POST /api/admin/tickets/:id/notes`, `POST /api/admin/tickets/:id/draft`, and `GET /api/admin/events`.

## How it is built

```
client/  React 18, Vite, TypeScript, Tailwind CSS 4
server/  Node, Express, TypeScript, Prisma
         SQLite through Prisma for local development, tests and the live demo;
         PostgreSQL in production is a provider change in schema.prisma plus migrations
         JWT auth with bcrypt, server sent events for live updates
```

The repo holds two packages that deploy on their own. The client is a static build (Vercel). The API is a small Node service (Azure App Service). CORS takes an origin allowlist from the environment.

Two data decisions are worth mentioning. The login identity (`User`) is a separate table from the dataset's author record (`Author`), so the admin account needs no author row, and an author's access is derived from their token rather than from any id the client sends. Tickets store where each classification came from (`AI`, `FALLBACK` or `ADMIN`) next to the value itself, so the team can always tell what the model said, what the rules said, and what a person changed.

For components, the layout is hand written in Tailwind with the project's own colour tokens, and I used Radix primitives (Select, Dialog, Toast, Tooltip) in the shadcn style for the controls where browser defaults are weakest. Dropdowns and dialogs get proper keyboard navigation and ARIA behaviour, and the screens look exactly as designed. I did not use a styled component library because its visual language would have fought the design on a surface this size.

The seed (`server/prisma/seed.ts`) loads the provided `bookleaf_sample_data.json` as it is, 10 authors and 18 books, and creates the demo accounts above. Running it twice changes nothing.

## The AI part

There are two AI jobs here, classifying tickets and drafting replies, and I picked the models by testing instead of guessing. I ran the brief's own seven sample queries, plus a draft built on a real author's figures, through the models I had access to on three routes (Vercel AI Gateway, FastRouter and OpenAI directly): gpt-4o-mini, Claude Haiku 4.5, Gemini 2.5 Flash and Llama 4 Scout.

Classification went to gpt-4o-mini. It tied for the best accuracy, and its only miss was the book description update, which every model got wrong and which is honestly ambiguous between General Inquiry and a metadata issue. It also returned the cleanest JSON and cost about $0.000036 per ticket.

Drafts went to Claude Haiku 4.5. Its replies sounded the most like the samples in the brief, and it was the only model that asked the author to confirm her bank details, which the brief's own model answer includes. It costs about $0.0018 per draft, and drafts are generated once and stored on the ticket, so that cost does not repeat. Haiku had one real flaw in testing: it once invented a payout history that contradicted the figures it was given. The production prompt now tells it plainly to use only the figures in front of it and not to speculate about past quarters, and the live drafts have stayed clean since.

A second round then put the current flagship models through the same prompts and scoring: GPT-5.5, Claude Opus and Sonnet, Gemini 3.1 Pro, Grok, Mistral Large, Qwen 3 and a few more. None of them beat either pick. Most of the flagship failures were mechanical rather than about quality. The app calls the classifier with a 120 token budget and the drafter with 600, and the reasoning models spent those budgets thinking, then returned empty or cut off output. Gemini 3.1 Pro scored 18 out of 18 when I gave it a larger diagnostic budget, so it is capable; it just cannot show it inside the limits this app runs with. It is the first model I would retest if those budgets are ever raised.

Gemini 2.5 Flash did badly enough that I dropped it. At sensible token budgets its reasoning used up most of the allowance, five of seven classifications came back cut off, the draft returned as a stub, and it cost roughly twenty times gpt-4o-mini.

The classification prompt is kept tight on purpose: the six categories, the brief's priority criteria, JSON only. Whatever comes back is checked against the category list before it is stored, and anything off list is thrown away. Drafts are validated the same way, because the ticket text is an author's own words and cannot be trusted as instructions: a draft carrying a link, markdown, an unresolved placeholder or an echoed instruction is refused, the rules based draft takes its place, and a classification that finishes after an admin has corrected the ticket can no longer overwrite the correction. The draft prompt is grounded in one Knowledge Base module that both the AI path and the fallback path read, so the policy facts (the 80/20 split on net profit, quarterly payment within 45 days, the ₹1,000 threshold, ISBN escalation, print turnaround and the free reprint rule, distribution windows, the nine production stages, and BookLeaf's tone guidance) cannot drift between the two.

That fallback matters. Every AI call has a 12 second timeout, and if the provider is down, slow, rate limited, or simply not configured, a deterministic rules engine does the job instead: keyword based classification, priority rules taken from the brief, and template drafts filled with the author's actual figures. It scores 7 out of 7 on the brief's sample queries, including Critical for the author who had waited six months and High for the ISBN error. With no API key set at all, the portal still classifies, prioritises and drafts. The queue just labels those tickets as rules based.

On cost: classification is a call of about 200 tokens on a small model. Drafts are the only bigger call and they are cached. The server logs the usage object each provider returns, which includes per call cost on these routes. At the volume BookLeaf describes, the AI bill for this system would sit in single digit dollars a month.

## Running it locally

```bash
# server, first terminal
cd server
cp .env.example .env        # set JWT_SECRET; the AI keys are optional
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run dev                 # API on http://localhost:4000

# client, second terminal
cd client
npm install
npm run dev                 # app on http://localhost:5173, /api proxied to :4000
```

## Tests

`cd server && npm test` runs 45 tests, all passing. They cover login and role enforcement, login throttling, the event streams, authors being unable to touch each other's books or tickets, the admin flow from queue to reply to resolved, the queue's date filters, internal notes staying invisible to authors, the fallback engine against the brief's seven samples, draft grounding in real figures, the parsing and validation of model output, and a classification that lands late never overwriting an admin's correction.

## What is not in here, and what I would add next

Attachments are a field in the form only, which the brief allows. In production they would go to object storage with signed URLs and a scan step. The event hub lives in one process, so it suits a single instance; the publish and subscribe calls are small, and Redis pub/sub is the obvious swap when the API runs on more than one box. The queue would get search and SLA timers next, and authors currently start a fresh ticket to follow up on a closed one, so a follow up composer is on the list. Password reset and email verification are not built; the auth middleware is shaped so both can be added without touching the routes. The one classification case every model missed would get a few worked examples added to the prompt.
