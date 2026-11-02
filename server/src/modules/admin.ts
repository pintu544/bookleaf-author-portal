import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/errors";
import { publishTicketEvent } from "../lib/events";
import { requireAuth, requireRole } from "../middleware/auth";
import { CATEGORIES, PRIORITIES, TICKET_STATUSES, type TicketStatus } from "../lib/types";

/**
 * Admin ticket management: filtered queue, full ticket view (including
 * internal notes, which are never exposed on author routes), status and
 * classification overrides, assignment, replies and internal notes.
 */
export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

const queueQuery = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const PRIORITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

adminRouter.get("/tickets", async (req, res, next) => {
  try {
    const parsed = queueQuery.safeParse(req.query);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION_ERROR", "Invalid queue filters", parsed.error.flatten());
    }
    const { status, category, priority, from, to } = parsed.data;
    const tickets = await prisma.ticket.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
        ...(priority ? { priority } : {}),
        ...(from || to
          ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
      },
      include: {
        author: { select: { id: true, name: true, email: true, city: true } },
        book: { select: { id: true, title: true } },
        _count: { select: { messages: true, notes: true } },
      },
    });
    // Urgent first, then oldest unresolved: critical/high float up, and
    // within a priority band the longest-waiting ticket leads.
    const openRank = (s: string) => (s === "OPEN" || s === "IN_PROGRESS" ? 0 : 1);
    tickets.sort(
      (a, b) =>
        openRank(a.status) - openRank(b.status) ||
        (PRIORITY_RANK[a.priority ?? "LOW"] ?? 3) - (PRIORITY_RANK[b.priority ?? "LOW"] ?? 3) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
    res.json({ tickets });
  } catch (err) {
    next(err);
  }
});

async function loadTicket(id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      author: true,
      book: true,
      messages: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) throw new ApiError(404, "NOT_FOUND", "Ticket not found");
  return ticket;
}

adminRouter.get("/tickets/:id", async (req, res, next) => {
  try {
    res.json({ ticket: await loadTicket(req.params.id) });
  } catch (err) {
    next(err);
  }
});

const patchSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    category: z.enum(CATEGORIES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assignedToMe: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

adminRouter.patch("/tickets/:id", async (req, res, next) => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION_ERROR", "Invalid update", parsed.error.flatten());
    }
    const ticket = await loadTicket(req.params.id);
    const { status, category, priority, assignedToMe } = parsed.data;
    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        ...(status ? { status: status as TicketStatus } : {}),
        // A human changing the AI's call is recorded as an override so the
        // queue can show where the AI was corrected.
        ...(category ? { category, categorySource: "OVERRIDDEN" } : {}),
        ...(priority ? { priority, prioritySource: "OVERRIDDEN" } : {}),
        ...(assignedToMe ? { assignedToId: req.user!.userId } : {}),
      },
    });
    publishTicketEvent("ticket-updated", ticket.authorId, { ticketId: ticket.id });
    res.json({ ticket: updated });
  } catch (err) {
    next(err);
  }
});

const replySchema = z.object({ body: z.string().trim().min(1).max(5000) });

adminRouter.post("/tickets/:id/replies", async (req, res, next) => {
  try {
    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION_ERROR", "Reply cannot be empty", parsed.error.flatten());
    }
    const ticket = await loadTicket(req.params.id);
    const message = await prisma.ticketMessage.create({
      data: { ticketId: ticket.id, senderRole: "ADMIN", body: parsed.data.body },
    });
    // A reply on an untouched ticket moves it into progress automatically.
    if (ticket.status === "OPEN") {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "IN_PROGRESS" } });
    }
    publishTicketEvent("message-added", ticket.authorId, { ticketId: ticket.id, messageId: message.id });
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

const noteSchema = z.object({ body: z.string().trim().min(1).max(2000) });

adminRouter.post("/tickets/:id/notes", async (req, res, next) => {
  try {
    const parsed = noteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION_ERROR", "Note cannot be empty", parsed.error.flatten());
    }
    const ticket = await loadTicket(req.params.id);
    const note = await prisma.internalNote.create({
      data: { ticketId: ticket.id, adminId: req.user!.userId, body: parsed.data.body },
    });
    res.status(201).json({ note });
  } catch (err) {
    next(err);
  }
});
