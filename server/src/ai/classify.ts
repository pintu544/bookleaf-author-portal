import { prisma } from "../lib/prisma";
import { publishTicketEvent } from "../lib/events";
import { classifyFallback, draftFallback, type DraftContext } from "./fallback";
import { classifyWithLlm, draftWithLlm, llmConfigured, validateDraft } from "./llm";

/**
 * The AI service: LLM first, deterministic fallback always behind it.
 *
 * classifyTicket runs fire-and-forget after ticket creation. A model call
 * can take seconds, and an admin may correct the ticket in that window, so
 * the result is applied field by field with the human-override guard inside
 * the UPDATE's WHERE clause: the check and the write are one atomic
 * statement, and a late classification can never overwrite a correction.
 * The source ("AI" or "FALLBACK") is recorded so the admin UI can show
 * where a call came from and overrides stay visible.
 */
export async function classifyTicket(ticketId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (!ticket || ticket.category) return;
  const firstMessage = ticket.messages[0]?.body ?? "";

  let result = classifyFallback(ticket.subject, firstMessage);
  let source = "FALLBACK";
  if (llmConfigured("CLASSIFY")) {
    try {
      result = await classifyWithLlm(ticket.subject, firstMessage);
      source = "AI";
    } catch (err) {
      console.error("LLM classification failed; fallback used", err);
    }
  }

  const categoryWrite = await prisma.ticket.updateMany({
    where: {
      id: ticketId,
      category: null,
      OR: [{ categorySource: null }, { categorySource: { not: "ADMIN" } }],
    },
    data: { category: result.category, categorySource: source },
  });
  const priorityWrite = await prisma.ticket.updateMany({
    where: {
      id: ticketId,
      OR: [{ prioritySource: null }, { prioritySource: { not: "ADMIN" } }],
    },
    data: { priority: result.priority, prioritySource: source },
  });
  if (categoryWrite.count > 0 || priorityWrite.count > 0) {
    publishTicketEvent("ticket-updated", ticket.authorId, { ticketId });
  }
}

/** Build the grounding context for a draft from the author's real record. */
async function draftContext(ticketId: string): Promise<{
  ctx: DraftContext;
  subject: string;
  body: string;
  category: string;
}> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      author: true,
      book: true,
      messages: { orderBy: { createdAt: "asc" }, take: 1 },
    },
  });
  if (!ticket) throw new Error("Ticket not found");
  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;
  return {
    ctx: {
      authorName: ticket.author.name,
      bookTitle: ticket.book?.title ?? null,
      bookStatus: ticket.book?.status ?? null,
      royaltyPending: ticket.book?.royaltyPending ?? null,
      royaltyPaid: ticket.book?.royaltyPaid ?? null,
      lastPayoutDate: fmt(ticket.book?.lastRoyaltyPayoutDate ?? null),
    },
    subject: ticket.subject,
    body: ticket.messages[0]?.body ?? "",
    category: ticket.category ?? classifyFallback(ticket.subject, ticket.messages[0]?.body ?? "").category,
  };
}

export async function generateDraft(ticketId: string): Promise<{ draft: string; source: string }> {
  const { ctx, subject, body, category } = await draftContext(ticketId);
  if (llmConfigured("DRAFT")) {
    try {
      const facts = [
        ctx.bookTitle ? `Book: "${ctx.bookTitle}" (status: ${ctx.bookStatus ?? "unknown"})` : "General / account-level query",
        ctx.royaltyPending != null ? `Royalty pending ₹${ctx.royaltyPending}` : null,
        ctx.royaltyPaid != null ? `Royalty already paid ₹${ctx.royaltyPaid}` : null,
        ctx.lastPayoutDate ? `Last payout ${ctx.lastPayoutDate}` : null,
      ]
        .filter(Boolean)
        .join("; ");
      const rawDraft = await draftWithLlm({ subject, body, authorName: ctx.authorName, bookFacts: facts || "No book linked" });
      const draft = validateDraft(rawDraft);
      if (!draft) {
        console.error("LLM draft failed validation; fallback used");
        return { draft: draftFallback(category as never, ctx), source: "FALLBACK" };
      }
      return { draft, source: "AI" };
    } catch (err) {
      console.error("LLM draft failed; fallback used", err);
    }
  }
  return { draft: draftFallback(category as never, ctx), source: "FALLBACK" };
}
