import { defineConfig } from "vitest/config";

process.env.DATABASE_URL = "file:./test.db";
process.env.JWT_SECRET = "test-secret";

export default defineConfig({
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    testTimeout: 20000,
  },
});
