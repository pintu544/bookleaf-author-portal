import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";

/** Author-facing endpoints. The authorId always comes from the JWT, never
 *  from the request, so an author can only ever see their own data. */
export const authorRouter = Router();

authorRouter.use(requireAuth, requireRole("AUTHOR"));

authorRouter.get("/books", async (req, res, next) => {
  try {
    const books = await prisma.book.findMany({
      where: { authorId: req.user!.authorId! },
      orderBy: { publicationDate: "desc" },
    });
    const summary = books.reduce(
      (acc, b) => ({
        totalCopiesSold: acc.totalCopiesSold + b.totalCopiesSold,
        totalRoyaltyEarned: acc.totalRoyaltyEarned + b.totalRoyaltyEarned,
        royaltyPaid: acc.royaltyPaid + b.royaltyPaid,
        royaltyPending: acc.royaltyPending + b.royaltyPending,
      }),
      { totalCopiesSold: 0, totalRoyaltyEarned: 0, royaltyPaid: 0, royaltyPending: 0 },
    );
    res.json({
      books: books.map((b) => ({ ...b, availableOn: JSON.parse(b.availableOn) as string[] })),
      summary: { bookCount: books.length, ...summary },
    });
  } catch (err) {
    next(err);
  }
});

authorRouter.get("/profile", async (req, res, next) => {
  try {
    const author = await prisma.author.findUnique({ where: { id: req.user!.authorId! } });
    if (!author) throw new ApiError(404, "NOT_FOUND", "Author profile not found");
    res.json({ author });
  } catch (err) {
    next(err);
  }
});
