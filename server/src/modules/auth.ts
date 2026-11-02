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

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION_ERROR", "Email and password are required", parsed.error.flatten());
    }
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }
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
