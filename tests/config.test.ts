import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { getConfig } from "../packages/config/src/index.js";

function environment(): NodeJS.ProcessEnv {
  return {
    CI_SECRET_DIR: "__no_test_secrets__",
    DATABASE_URL: "postgresql://localhost/creator_intelligence_test",
    APP_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    MCP_TOKEN: "fixture-mcp-" + "x".repeat(32),
    WORKER_TOKEN: "fixture-worker-" + "x".repeat(32),
    OWNED_CHANNEL_ID: "UC1111111111111111111111",
    GOOGLE_PROJECT_NUMBER: "123456789012",
  };
}

describe("installation identity", () => {
  it("uses the operator's channel and project without maintainer defaults", () => {
    const config = getConfig(environment());
    expect(config.OWNED_CHANNEL_ID).toBe("UC1111111111111111111111");
    expect(config.GOOGLE_PROJECT_NUMBER).toBe("123456789012");
    expect(config.GOOGLE_CLIENT_ID).toBeUndefined();
  });
  it("rejects missing channel identity instead of connecting to a default", () => {
    const env = environment();
    delete env.OWNED_CHANNEL_ID;
    expect(() => getConfig(env)).toThrow();
  });
  it("rejects unset or malformed project and channel placeholders", () => {
    expect(() => getConfig({ ...environment(), GOOGLE_PROJECT_NUMBER: undefined })).toThrow();
    expect(() => getConfig({ ...environment(), GOOGLE_PROJECT_NUMBER: "YOUR_PROJECT_NUMBER" })).toThrow();
    expect(() => getConfig({ ...environment(), OWNED_CHANNEL_ID: "YOUR_CHANNEL_ID" })).toThrow();
  });
});
