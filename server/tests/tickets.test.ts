import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const app = createApp();

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token as string;
}

describe("author tickets", () => {
  let priya: string;
  let rohit: string;
  let ticketId: string;

  beforeAll(async () => {
    priya = await login("priya.sharma@email.com", "bookleaf123");
    rohit = await login("rohit.kapoor@email.com", "bookleaf123");
  });

  it("creates a ticket linked to the author's own book", async () => {
    const res = await request(app)
      .post("/api/me/tickets")
      .set("Authorization", `Bearer ${priya}`)
      .send({
        bookId: "BK001",
        subject: "Royalty not received yet",
        description: "I published my book months ago and still have not received any royalty. Please check.",
      });
    expect(res.status).toBe(201);
    expect(res.body.ticket.status).toBe("OPEN");
    expect(res.body.ticket.book.title).toBe("Whispers of the Ganges");
    expect(res.body.ticket.messages).toHaveLength(1);
    expect(res.body.ticket.messages[0].senderRole).toBe("AUTHOR");
    ticketId = res.body.ticket.id;
  });

  it("creates a general (account-level) ticket with no book", async () => {
    const res = await request(app)
      .post("/api/me/tickets")
      .set("Authorization", `Bearer ${priya}`)
      .send({ bookId: null, subject: "Update my author bio", description: "Please update the bio shown on my author page." });
    expect(res.status).toBe(201);
    expect(res.body.ticket.bookId).toBeNull();
  });

  it("rejects a ticket against another author's book", async () => {
    // BK001 belongs to Priya; Rohit must not attach a ticket to it.
    const res = await request(app)
      .post("/api/me/tickets")
      .set("Authorization", `Bearer ${rohit}`)
      .send({ bookId: "BK001", subject: "Not my book", description: "Trying to file against someone else's book." });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_BOOK");
  });

  it("validates the form fields", async () => {
    const res = await request(app)
      .post("/api/me/tickets")
      .set("Authorization", `Bearer ${priya}`)
      .send({ subject: "x", description: "short" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("lists only the author's own tickets", async () => {
    const res = await request(app).get("/api/me/tickets").set("Authorization", `Bearer ${rohit}`);
    expect(res.status).toBe(200);
    expect(res.body.tickets.every((t: { authorId: string }) => t.authorId === "AUTH002")).toBe(true);
  });

  it("hides another author's ticket detail as 404", async () => {
    const res = await request(app).get(`/api/me/tickets/${ticketId}`).set("Authorization", `Bearer ${rohit}`);
    expect(res.status).toBe(404);
  });
});
