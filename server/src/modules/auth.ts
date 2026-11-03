import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/errors";
import { signToken } from "../middleware/auth";
import type { Role } from "../lib/types";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRouter = Router();

/**
 * Brute-force throttle: failed logins are counted per account and address
 * together, so a lockout can only ever fall on the account under attack,
 * never on every user who happens to share a proxy or NAT address.
 */
const failures = new Map<string, number[]>();
const FAILURE_WINDOW_MS = 10 * 60_000;
const MAX_FAILURES = 10;

function recentFailures(key: string, now: number): number[] {
  const list = (failures.get(key) ?? []).filter((t) => now - t < FAILURE_WINDOW_MS);
  if (list.length) failures.set(key, list);
  else failures.delete(key);
  return list;
}

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION_ERROR", "Email and password are required", parsed.error.flatten());
    }
    const { email, password } = parsed.data;
    const throttleKey = `${req.ip ?? "?"}:${email.toLowerCase()}`;
    if (recentFailures(throttleKey, Date.now()).length >= MAX_FAILURES) {
      throw new ApiError(429, "RATE_LIMITED", "Too many failed login attempts. Please wait a few minutes and try again.");
    }
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      const list = recentFailures(throttleKey, Date.now());
      list.push(Date.now());
      failures.set(throttleKey, list);
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }
    failures.delete(throttleKey);
    const role = user.role as Role;
    const token = signToken({ userId: user.id, role, authorId: user.authorId });
    res.json({
      token,
      user: { id: user.id, email: user.email, role, authorId: user.authorId },
    });
  } catch (err) {
    next(err);
  }
});
