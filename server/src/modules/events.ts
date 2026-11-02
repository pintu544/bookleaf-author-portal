import { Router } from "express";
import jwt from "jsonwebtoken";
import { openStream } from "../lib/events";
import { ApiError } from "../lib/errors";
import type { AuthUser } from "../middleware/auth";

/**
 * SSE endpoints. EventSource cannot set an Authorization header, so these
 * two routes accept the JWT as a `?token=` query parameter — a deliberate,
 * documented trade-off scoped to the read-only event stream only. Every
 * other route requires the header.
 */
function userFromQueryToken(token: string | undefined): AuthUser {
  if (!token) throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new ApiError(500, "INTERNAL", "Server is not configured");
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    return {
      userId: String(payload.sub),
      role: payload.role as AuthUser["role"],
      authorId: (payload.authorId as string | null) ?? null,
    };
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "Session expired or invalid");
  }
}

export function eventsRouter(): Router {
  const router = Router();

  router.get("/me/events", (req, res, next) => {
    try {
      const user = userFromQueryToken(req.query.token as string | undefined);
      if (user.role !== "AUTHOR" || !user.authorId) throw new ApiError(403, "FORBIDDEN", "Author access only");
      openStream(res, `author:${user.authorId}`);
    } catch (err) {
      next(err);
    }
  });

  router.get("/admin/events", (req, res, next) => {
    try {
      const user = userFromQueryToken(req.query.token as string | undefined);
      if (user.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Admin access only");
      openStream(res, "admins");
    } catch (err) {
      next(err);
    }
  });

  return router;
}
