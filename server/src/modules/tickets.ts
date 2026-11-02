import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";

/**
 * Ticket endpoints shared shape. Author routes live under /api/me/tickets
 * and are scoped by the JWT authorId. Admin routes live in admin.ts.
 */

const createTicketSchema = z.object({
  bookId: z.string().nullable().optional(),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
});

export function serializeTicket<T extends { book?: unknown }>(ticket: T) {
  return ticket;
}

export const authorTicketsRouter = Router();
authorTicketsRouter.use(requireAuth, requireRole("AUTHOR"));

authorTicketsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION_ERROR", "Please check the ticket fields", parsed.error.flatten());
    }
    const authorId = req.user!.authorId!;
    const { bookId, subject, description } = parsed.data;

    if (bookId) {
      const book = await prisma.book.findUnique({ where: { id: bookId } });
      if (!book || book.authorId !== authorId) {
        throw new ApiError(422, "INVALID_BOOK", "Please select one of your own books, or General / Account Level");
      }
    }

    // The ticket row is created first and returned immediately; AI
    // classification runs asynchronously afterwards (see ai module) so a
    // slow or unavailable AI provider can never block ticket creation.
    const ticket = await prisma.ticket.create({
      data: {
        authorId,
        bookId: bookId ?? null,
        subject,
        messages: { create: { senderRole: "AUTHOR", body: description } },
      },
      include: { book: true, messages: { orderBy: { createdAt: "asc" } } },
    });

    // Fire-and-forget classification; failures are swallowed by design
    // (the fallback engine inside classifyTicket covers provider outages).
    void import("../ai/classify")
      .then((m) => m.classifyTicket(ticket.id))
      .catch((err) => console.error("classification failed", err));

    res.status(201).json({ ticket });
  } catch (err) {
    next(err);
  }
});

authorTicketsRouter.get("/", async (req, res, next) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { authorId: req.user!.authorId! },
      include: { book: true, messages: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ tickets });
  } catch (err) {
    next(err);
  }
});

authorTicketsRouter.get("/:id", async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: { book: true, messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!ticket || ticket.authorId !== req.user!.authorId) {
      throw new ApiError(404, "NOT_FOUND", "Ticket not found");
    }
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
});
