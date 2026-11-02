import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ApiError, errorBody } from "./lib/errors";
import { authRouter } from "./modules/auth";
import { authorRouter } from "./modules/author";
import { authorTicketsRouter } from "./modules/tickets";

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/me", authorRouter);
  app.use("/api/me/tickets", authorTicketsRouter);

  app.use((_req, _res, next) => next(new ApiError(404, "NOT_FOUND", "Route not found")));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      res.status(err.status).json(errorBody(err));
    } else {
      // Never leak a bare 500 with internals; log server-side instead.
      console.error(err);
      res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong on our side" } });
    }
  });

  return app;
}
