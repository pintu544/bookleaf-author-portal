import type { Server } from "node:http";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";

/**
 * The SSE streams authenticate with a ?token= query parameter because
 * EventSource cannot set headers. These tests pin the routing: the stream
 * endpoints must be reached before the header-auth routers that own the
 * /api/me and /api/admin prefixes, or every stream dies with a 401.
 */
const app = createApp();

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token as string;
}

/** Open a stream, read its first chunk, then hang up. */
async function firstChunk(base: string, path: string): Promise<{ status: number; chunk: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${base}${path}`, { signal: controller.signal });
    if (!res.body) return { status: res.status, chunk: "" };
    const reader = res.body.getReader();
    const { value } = await reader.read();
    controller.abort();
    return { status: res.status, chunk: new TextDecoder().decode(value ?? new Uint8Array()) };
  } finally {
    clearTimeout(timer);
  }
}

describe("event streams", () => {
  let server: Server;
  let base: string;
  let author: string;
  let admin: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address();
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
    author = await login("priya.sharma@email.com", "bookleaf123");
    admin = await login("admin@bookleafpub.com", "admin123");
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("streams to an author with a query token", async () => {
    const { status, chunk } = await firstChunk(base, `/api/me/events?token=${encodeURIComponent(author)}`);
    expect(status).toBe(200);
    expect(chunk).toContain(": connected");
  });

  it("streams to an admin with a query token", async () => {
    const { status, chunk } = await firstChunk(base, `/api/admin/events?token=${encodeURIComponent(admin)}`);
    expect(status).toBe(200);
    expect(chunk).toContain(": connected");
  });

  it("rejects a stream with no token and a stream with the wrong role", async () => {
    const noToken = await fetch(`${base}/api/me/events`);
    expect(noToken.status).toBe(401);
    await noToken.arrayBuffer().catch(() => undefined);
    const wrongRole = await fetch(`${base}/api/admin/events?token=${encodeURIComponent(author)}`);
    expect(wrongRole.status).toBe(403);
    await wrongRole.arrayBuffer().catch(() => undefined);
  });
});
