import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_MODE: z.enum(["live", "demo", "test"]).default("live"),
  APP_ORIGIN: z.string().url().default("http://localhost:4310"),
  API_ORIGIN: z.string().url().default("http://localhost:4311"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().default(4311),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://127.0.0.1:6438"),
  OWNER_ID: z.string().uuid().default("f138040b-e70b-4372-9ccf-eb06a49e6720"),
  OWNED_CHANNEL_ID: z.string().regex(/^UC[\w-]{22}$/),
  OWNER_PASSWORD: z.string().min(16).optional(),
  APP_ENCRYPTION_KEY: z.string().min(43),
  MCP_TOKEN: z.string().min(32),
  WORKER_TOKEN: z.string().min(32),
  YOUTUBE_DATA_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4311/api/v1/auth/google/callback"),
  GOOGLE_PROJECT_NUMBER: z.string().regex(/^\d+$/),
  LOCAL_LLM_BASE_URL: z.string().url().optional(),
  LOCAL_LLM_MODEL: z.string().optional(),
  BACKUP_DIR: z.string().default("backups/automatic"),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  GENERAL_DAILY_BUDGET: z.coerce.number().int().min(1).max(9000).default(9000),
  SEARCH_DAILY_BUDGET: z.coerce.number().int().min(1).max(90).default(90),
  BATCH_DAILY_BUDGET: z.coerce.number().int().min(1).max(9000).default(9000),
});
export type Config = z.infer<typeof schema>;
export function getConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const secretsDir =
    env.CI_SECRET_DIR ?? join(homedir(), ".creator-intelligence", "secrets");
  const clientPath = join(secretsDir, "google-client.json");
  const client = existsSync(clientPath)
    ? (
        JSON.parse(readFileSync(clientPath, "utf8")) as {
          web?: { client_id: string; client_secret: string };
        }
      ).web
    : undefined;
  const config = schema.parse({
    ...env,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID ?? client?.client_id,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET ?? client?.client_secret,
  });
  if (Buffer.from(config.APP_ENCRYPTION_KEY, "base64").length !== 32)
    throw new Error("Encryption key must decode to 32 bytes");
  for (const value of [config.APP_ORIGIN, config.API_ORIGIN]) {
    const url = new URL(value);
    if (
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      throw new Error("Remote access requires HTTPS");
  }
  return config;
}
