import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Prepare an isolated test database (push schema + seed) once per run. */
export default function globalSetup() {
  const serverRoot = path.resolve(__dirname, "..");
  const dbFile = path.join(serverRoot, "prisma", "test.db");
  if (fs.existsSync(dbFile)) fs.rmSync(dbFile);
  const enginesDir = path.join(serverRoot, "node_modules", "@prisma", "engines");
  const env = {
    ...process.env,
    DATABASE_URL: "file:./test.db",
    JWT_SECRET: "test-secret",
    // Point Prisma at pre-fetched engine binaries when present (this VM's
    // network aborts Prisma's own engine downloads); harmless elsewhere.
    PRISMA_QUERY_ENGINE_LIBRARY:
      process.env.PRISMA_QUERY_ENGINE_LIBRARY ??
      path.join(enginesDir, "libquery_engine-debian-openssl-3.0.x.so.node"),
    PRISMA_SCHEMA_ENGINE_BINARY:
      process.env.PRISMA_SCHEMA_ENGINE_BINARY ?? path.join(enginesDir, "schema-engine-debian-openssl-3.0.x"),
    CHECKPOINT_DISABLE: "1",
  };
  execSync("npx prisma db push --skip-generate", { cwd: serverRoot, env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { cwd: serverRoot, env, stdio: "inherit" });
}
