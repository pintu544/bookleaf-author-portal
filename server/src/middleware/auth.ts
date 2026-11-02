import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../lib/errors";
import type { Role } from "../lib/types";

export interface AuthUser {
  userId: string;
  role: Role;
  authorId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ role: user.role, authorId: user.authorId }, secret(), {
    subject: user.userId,
    expiresIn: "24h",
  });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return next(new ApiError(401, "UNAUTHENTICATED", "Missing or malformed Authorization header"));
  }
  try {
    const payload = jwt.verify(header.slice(7), secret()) as jwt.JwtPayload;
    req.user = {
      userId: String(payload.sub),
      role: payload.role as Role,
      authorId: (payload.authorId as string | null) ?? null,
    };
    next();
  } catch {
    next(new ApiError(401, "INVALID_TOKEN", "Session expired or invalid — please log in again"));
  }
}

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new ApiError(401, "UNAUTHENTICATED", "Not authenticated"));
    if (req.user.role !== role) return next(new ApiError(403, "FORBIDDEN", "You do not have access to this resource"));
    next();
  };
}
