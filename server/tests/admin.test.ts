import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const app = createApp();

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token as string;
}

describe("admin ticket management", () => {
  let admin: string;
  let priya: string;
  let ticketId: string;

  beforeAll(async () => {
    admin = await login("admin@bookleafpub.com", "admin123");
    priya = await login("priya.sharma@email.com", "bookleaf123");
    const created = await request(app)
      .post("/api/me/tickets")
      .set("Authorization", `Bearer ${priya}`)
      .send({
        bookId: "BK001",
        subject: "Royalty pending since two quarters",
        description: "My royalty of 3570 rupees has been pending for two quarters. Please release it.",
      });
    ticketId = created.body.ticket.id;
  });

  it("blocks authors from the admin queue", async () => {
    const res = await request(app).get("/api/admin/tickets").set("Authorization", `Bearer ${priya}`);
    expect(res.status).toBe(403);
  });

  it("lists the queue for admins with author and book context", async () => {
    const res = await request(app).get("/api/admin/tickets").set("Authorization", `Bearer ${admin}`);
    expect(res.status).toBe(200);
    const mine = res.body.tickets.find((t: { id: string }) => t.id === ticketId);
    expect(mine).toBeTruthy();
    expect(mine.author.name).toBe("Priya Sharma");
    expect(mine.book.title).toBe("Whispers of the Ganges");
  });

  it("filters the queue by status", async () => {
    const res = await request(app)
      .get("/api/admin/tickets?status=RESOLVED")
      .set("Authorization", `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body.tickets.every((t: { status: string }) => t.status === "RESOLVED")).toBe(true);
  });

  it("rejects an invalid filter value", async () => {
    const res = await request(app)
      .get("/api/admin/tickets?status=BOGUS")
      .set("Authorization", `Bearer ${admin}`);
    expect(res.status).toBe(422);
  });

  it("records classification and priority changes as overrides", async () => {
    const res = await request(app)
      .patch(`/api/admin/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ category: "Royalty & Payments", priority: "HIGH", assignedToMe: true });
    expect(res.status).toBe(200);
    expect(res.body.ticket.categorySource).toBe("OVERRIDDEN");
    expect(res.body.ticket.prioritySource).toBe("OVERRIDDEN");
    expect(res.body.ticket.assignedToId).toBeTruthy();
  });

  it("posts a reply that the author can read, moving the ticket to In Progress", async () => {
    const res = await request(app)
      .post(`/api/admin/tickets/${ticketId}/replies`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ body: "Dear Priya, we have checked with our accounts team and will update you by Friday." });
    expect(res.status).toBe(201);

    const authorView = await request(app)
      .get(`/api/me/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${priya}`);
    expect(authorView.body.ticket.status).toBe("IN_PROGRESS");
    const bodies = authorView.body.ticket.messages.map((m: { body: string }) => m.body);
    expect(bodies.some((b: string) => b.includes("accounts team"))).toBe(true);
  });

  it("keeps internal notes invisible to the author", async () => {
    const note = await request(app)
      .post(`/api/admin/tickets/${ticketId}/notes`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ body: "Escalated to accounts — payout file was missed in Q2 batch." });
    expect(note.status).toBe(201);

    const adminView = await request(app)
      .get(`/api/admin/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${admin}`);
    expect(adminView.body.ticket.notes).toHaveLength(1);

    const authorView = await request(app)
      .get(`/api/me/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${priya}`);
    expect(JSON.stringify(authorView.body)).not.toContain("Escalated to accounts");
    expect(authorView.body.ticket.notes).toBeUndefined();
  });

  it("updates status through the lifecycle", async () => {
    const res = await request(app)
      .patch(`/api/admin/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ status: "RESOLVED" });
    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("RESOLVED");
  });
});
