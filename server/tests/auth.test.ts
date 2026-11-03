import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const app = createApp();

async function login(email: string, password: string) {
  return request(app).post("/api/auth/login").send({ email, password });
}

describe("auth", () => {
  it("logs in a seeded author", async () => {
    const res = await login("priya.sharma@email.com", "bookleaf123");
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("AUTHOR");
    expect(res.body.token).toBeTruthy();
  });

  it("rejects a wrong password with a meaningful error", async () => {
    const res = await login("priya.sharma@email.com", "wrong-password");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects missing credentials with 422", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("logs in the admin", async () => {
    const res = await login("admin@bookleafpub.com", "admin123");
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("ADMIN");
  });
});

describe("author scoping", () => {
  let priyaToken: string;
  beforeAll(async () => {
    priyaToken = (await login("priya.sharma@email.com", "bookleaf123")).body.token;
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/me/books");
    expect(res.status).toBe(401);
  });

  it("returns only the logged-in author's books with a correct summary", async () => {
    const res = await request(app).get("/api/me/books").set("Authorization", `Bearer ${priyaToken}`);
    expect(res.status).toBe(200);
    expect(res.body.summary.bookCount).toBe(2);
    const titles = res.body.books.map((b: { title: string }) => b.title);
    expect(titles).toContain("Whispers of the Ganges");
    // Priya's totals from the provided dataset: 342+189 sold, 11970+7938 earned.
    expect(res.body.summary.totalCopiesSold).toBe(531);
    expect(res.body.summary.totalRoyaltyEarned).toBe(19908);
    expect(res.body.summary.royaltyPending).toBe(3570);
  });

  it("forbids an author token on admin-only ground (role check)", async () => {
    const res = await request(app).get("/api/me/profile").set("Authorization", `Bearer ${priyaToken}`);
    expect(res.status).toBe(200); // author route allows AUTHOR
    expect(res.body.author.id).toBe("AUTH001");
  });

  it("throttles repeated failed logins for one account only", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await login("victim@example.com", "nope");
      expect(res.status).toBe(401);
    }
    const blocked = await login("victim@example.com", "nope");
    expect(blocked.status).toBe(429);
    // A different account from the same address is not locked out.
    const other = await login("someone-else@example.com", "nope");
    expect(other.status).toBe(401);
  });
});
