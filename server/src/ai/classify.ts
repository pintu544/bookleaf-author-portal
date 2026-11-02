import { prisma } from "../lib/prisma";
import { publishTicketEvent } from "../lib/events";
import { classifyFallback, draftFallback, type DraftContext } from "./fallback";
import { classifyWithLlm, draftWithLlm, llmConfigured } from "./llm";

/**
 * The AI service: LLM first, deterministic fallback always behind it.
 *
 * classifyTicket runs fire-and-forget after ticket creation. It patches
 * category/priority only when they are still unset and not human-touched,
 * and records the source ("AI" or "FALLBACK") so the admin UI can show
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

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { category: result.category, categorySource: source, priority: result.priority, prioritySource: source },
  });
  publishTicketEvent("ticket-updated", ticket.authorId, { ticketId });
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
      const draft = await draftWithLlm({ subject, body, authorName: ctx.authorName, bookFacts: facts || "No book linked" });
      return { draft, source: "AI" };
    } catch (err) {
      console.error("LLM draft failed; fallback used", err);
    }
  }
  return { draft: draftFallback(category as never, ctx), source: "FALLBACK" };
}
