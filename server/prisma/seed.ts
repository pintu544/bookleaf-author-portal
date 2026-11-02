import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import seedData from "./seed-data.json";

/**
 * Idempotent seed from the exact dataset BookLeaf provided
 * (server/prisma/seed-data.json — 10 authors, 18 books).
 *
 * Test credentials (documented in the README, demo only):
 *   every author  -> their dataset email / "bookleaf123"
 *   admin         -> admin@bookleafpub.com / "admin123"
 */
const prisma = new PrismaClient();

export const AUTHOR_TEST_PASSWORD = "bookleaf123";
export const ADMIN_EMAIL = "admin@bookleafpub.com";
export const ADMIN_TEST_PASSWORD = "admin123";

interface SeedBook {
  book_id: string;
  title: string;
  isbn: string;
  genre: string;
  publication_date: string | null;
  status: string;
  mrp: number | null;
  author_royalty_per_copy: number | null;
  total_copies_sold: number;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date: string | null;
  print_partner: string | null;
  available_on: string[];
}

interface SeedAuthor {
  author_id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  joined_date: string;
  books: SeedBook[];
}

async function main() {
  const authors = (seedData as { authors: SeedAuthor[] }).authors;
  const passwordHash = await bcrypt.hash(AUTHOR_TEST_PASSWORD, 10);

  for (const a of authors) {
    await prisma.author.upsert({
      where: { id: a.author_id },
      update: {},
      create: {
        id: a.author_id,
        name: a.name,
        email: a.email.toLowerCase(),
        phone: a.phone,
        city: a.city,
        joinedDate: new Date(a.joined_date),
      },
    });
    await prisma.user.upsert({
      where: { email: a.email.toLowerCase() },
      update: {},
      create: {
        email: a.email.toLowerCase(),
        passwordHash,
        role: "AUTHOR",
        authorId: a.author_id,
      },
    });
    for (const b of a.books) {
      await prisma.book.upsert({
        where: { id: b.book_id },
        update: {},
        create: {
          id: b.book_id,
          authorId: a.author_id,
          title: b.title,
          isbn: b.isbn,
          genre: b.genre,
          publicationDate: b.publication_date ? new Date(b.publication_date) : null,
          status: b.status,
          mrp: b.mrp,
          authorRoyaltyPerCopy: b.author_royalty_per_copy,
          totalCopiesSold: b.total_copies_sold,
          totalRoyaltyEarned: b.total_royalty_earned,
          royaltyPaid: b.royalty_paid,
          royaltyPending: b.royalty_pending,
          lastRoyaltyPayoutDate: b.last_royalty_payout_date ? new Date(b.last_royalty_payout_date) : null,
          printPartner: b.print_partner,
          availableOn: JSON.stringify(b.available_on),
        },
      });
    }
  }

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_TEST_PASSWORD, 10),
      role: "ADMIN",
    },
  });

  const [authorCount, bookCount] = await Promise.all([prisma.author.count(), prisma.book.count()]);
  console.log(`Seed complete: ${authorCount} authors, ${bookCount} books`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
