import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { getConfig } from "../packages/config/src/index.js";
import { Store } from "../packages/db/src/index.js";
import { hashPassword } from "../packages/security/src/index.js";
import { POLICY_VERSION } from "../packages/domain/src/policy.js";
export function testConfig() {
  const source = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!source)
    throw new Error(
      "PostgreSQL required: run scripts/with-local-env.ps1 pnpm test",
    );
  const url = new URL(source);
  url.pathname = "/creator_intelligence_test";
  return getConfig({
    ...process.env,
    DATABASE_URL: url.href,
    CI_SECRET_DIR: "__no_test_secrets__",
    APP_MODE: "test",
    OWNED_CHANNEL_ID: "UC0000000000000000000000",
    GOOGLE_PROJECT_NUMBER: "123456789012",
    NODE_ENV: "test",
    APP_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    OWNER_ID: randomUUID(),
    OWNER_PASSWORD: "fixture-only-long-test-password",
    MCP_TOKEN: randomBytes(32).toString("hex"),
    WORKER_TOKEN: randomBytes(32).toString("hex"),
    GOOGLE_CLIENT_ID: "fixture-client",
    GOOGLE_CLIENT_SECRET: "fixture-secret",
    YOUTUBE_DATA_API_KEY: "fixture-key",
  });
}
export async function testStore(options: { acceptPolicy?: boolean } = {}) {
  const config = testConfig(),
    admin = new Pool({
      connectionString:
        process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
    });
  try {
    await admin.query("CREATE DATABASE creator_intelligence_test");
  } catch (e) {
    const error = e as { code?: string; constraint?: string };
    // Parallel test workers can race on the catalog's unique index during
    // first-time database creation, rather than receive duplicate_database.
    if (
      error.code !== "42P04" &&
      !(
        error.code === "23505" &&
        error.constraint === "pg_database_datname_index"
      )
    )
      throw e;
  } finally {
    await admin.end();
  }
  const store = new Store(config.DATABASE_URL);
  await store.migrate();
  await store.initializeOwner(
    config.OWNER_ID,
    hashPassword(config.OWNER_PASSWORD!),
  );
  if (options.acceptPolicy !== false)
    await store.acceptPolicy(config.OWNER_ID, POLICY_VERSION, true);
  return {
    config,
    store,
    cleanup: async () => {
      await store.pool.query("DELETE FROM users WHERE id=$1", [
        config.OWNER_ID,
      ]);
      await store.close();
    },
  };
}
export const blueprint = {
  working_title: "An original lunch-break story",
  target_format: "youtube_shorts" as const,
  target_duration_seconds: 60,
  hook: "What if lunch scheduled you?",
  outline: ["Setup", "Escalation", "Payoff"],
  research_sources: [
    {
      url: "https://www.youtube.com/watch?v=8iKZM0jj6mo",
      note: "Reference only",
    },
  ],
  thumbnail_brief: "An original lunchbox clock illustration",
  script: "Original script.",
  risk_flags: ["No factual popularity claim"],
};
