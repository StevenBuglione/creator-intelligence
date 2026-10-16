import { describe, it, expect, vi } from "vitest";
import type { OAuth2Client } from "google-auth-library";
import { YouTube } from "../packages/youtube/src/index.js";
import { scopes, envelope } from "../packages/domain/src/index.js";
import { seal, digest } from "../packages/security/src/index.js";
import { Application } from "../packages/intelligence/src/index.js";
import { testStore } from "./helpers.js";
import { createServer } from "../apps/api/src/server.js";
describe("authorization and offline regressions", () => {
  it("boots and authenticates with all Google credentials absent, showing a disconnected live state", async () => {
    const { store, config } = await testStore();
    config.APP_MODE = "live";
    delete config.YOUTUBE_DATA_API_KEY;
    delete config.GOOGLE_CLIENT_ID;
    delete config.GOOGLE_CLIENT_SECRET;
    const server = await createServer(config, store);
    try {
      expect((await server.inject({ url: "/healthz" })).statusCode).toBe(200);
      const result = await server.inject({
        method: "POST",
        url: "/api/v1/operations/status",
        headers: { authorization: `Bearer ${config.MCP_TOKEN}` },
        payload: {},
      });
      expect(result.statusCode).toBe(200);
      expect(result.json().data).toMatchObject({
        mode: "live",
        public_api_configured: false,
        google: { configured: false, connected: false },
      });
    } finally {
      await store.pool.query("DELETE FROM users WHERE id=$1", [
        config.OWNER_ID,
      ]);
      await server.close();
    }
  });
  it("expires unverified owner authorization before returning cached analytics after a long outage", async () => {
    const { store, config, cleanup } = await testStore();
    try {
      config.APP_MODE = "live";
      await store.saveConnection(
        config.OWNER_ID,
        config.OWNED_CHANNEL_ID,
        scopes,
        "encrypted-fixture",
      );
      await store.pool.query(
        "UPDATE oauth_connections SET verified_at=now()-interval '31 days' WHERE owner_id=$1",
        [config.OWNER_ID],
      );
      await store.observe(
        config.OWNER_ID,
        config.OWNED_CHANNEL_ID,
        "owned_overview",
        { views: 42 },
        envelope(null, "youtube_analytics_api").meta,
        new Date(),
        "expired",
      );
      const result = await new Application(store, config).call(
        { owner: config.OWNER_ID, role: "agent" },
        "analytics",
        {},
      );
      expect(result.data).toEqual([]);
      expect(await store.connection(config.OWNER_ID)).toBeUndefined();
    } finally {
      await cleanup();
    }
  });
  it.each([
    "wrong_channel",
    "multiple_channels",
    "missing_scope",
    "extra_scope",
  ])("rejects OAuth %s without overwriting a connection", async (scenario) => {
    const { store, config, cleanup } = await testStore();
    try {
      const grant =
        scenario === "missing_scope"
          ? [scopes[0]!]
          : scenario === "extra_scope"
            ? [...scopes, "https://www.googleapis.com/auth/youtube.upload"]
            : scopes;
      const items =
        scenario === "multiple_channels"
          ? [
              {
                id: config.OWNED_CHANNEL_ID,
                snippet: { title: "A configured creator channel" },
              },
              { id: "other" },
            ]
          : [
              {
                id:
                  scenario === "wrong_channel"
                    ? "other"
                    : config.OWNED_CHANNEL_ID,
                snippet: { title: "A configured creator channel" },
              },
            ];
      const yt = new YouTube(store, config, {
        fetch: async () => new Response(JSON.stringify({ items })),
        sleep: async () => {},
      });
      vi.spyOn(yt, "oauth").mockReturnValue({
        getToken: async () => ({
          tokens: {
            scope: grant.join(" "),
            access_token: "a",
            refresh_token: "r",
          },
        }),
      } as unknown as OAuth2Client);
      await store.putSession(
        "negative-s",
        config.OWNER_ID,
        "c",
        new Date(Date.now() + 100000),
      );
      await store.putOAuthState(
        digest("negative-state"),
        config.OWNER_ID,
        "negative-s",
        seal({ verifier: "v" }, config.APP_ENCRYPTION_KEY, config.OWNER_ID),
      );
      await expect(
        yt.finishOAuth("negative-state", "code", "negative-s"),
      ).rejects.toThrow(
        scenario.includes("scope")
          ? "READ_ONLY_SCOPE_MISMATCH"
          : "CHANNEL_MISMATCH",
      );
      expect(await store.connection(config.OWNER_ID)).toBeUndefined();
    } finally {
      await cleanup();
    }
  });
  it("marks revoked Analytics credentials disconnected and removes private data", async () => {
    const { store, config, cleanup } = await testStore();
    try {
      await store.saveConnection(
        config.OWNER_ID,
        config.OWNED_CHANNEL_ID,
        scopes,
        seal(
          { access_token: "a", expiry_date: Date.now() + 3600000 },
          config.APP_ENCRYPTION_KEY,
          config.OWNER_ID,
        ),
      );
      await store.observe(
        config.OWNER_ID,
        config.OWNED_CHANNEL_ID,
        "owned_overview",
        { rows: [] },
        envelope(null, "youtube_analytics_api").meta,
        new Date(),
        "old",
      );
      const yt = new YouTube(store, config, {
        fetch: async () => new Response("{}", { status: 401 }),
        sleep: async () => {},
      });
      await expect(
        yt.analytics(config.OWNER_ID, "overview", "2026-10-01", "2026-10-02"),
      ).rejects.toThrow("GOOGLE_REAUTH_REQUIRED");
      expect(await store.connection(config.OWNER_ID)).toBeUndefined();
      expect(
        await store.observations(
          config.OWNER_ID,
          config.OWNED_CHANNEL_ID,
          "owned_overview",
        ),
      ).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });
  it("serves stale stored metrics while provider is offline; preserves missing values", async () => {
    const { store, config, cleanup } = await testStore();
    try {
      const meta = envelope(null, "youtube_analytics_api", {
        retrieved_at: new Date(Date.now() - 2 * 86400_000).toISOString(),
      }).meta;
      await store.observe(
        config.OWNER_ID,
        config.OWNED_CHANNEL_ID,
        "owned_overview",
        { rows: [{ views: 100, engagedViews: null }] },
        meta,
        new Date(),
        "offline",
      );
      const app = new Application(store, config);
      const result = (await app.call(
        { owner: config.OWNER_ID, role: "agent" },
        "analytics",
        {},
      )) as unknown as {
        data: {
          data: { rows: { views: number; engagedViews: null }[] };
          meta: { stale: boolean };
        }[];
      };
      expect(result.data[0]?.meta.stale).toBe(true);
      expect(result.data[0]?.data.rows[0]?.engagedViews).toBeNull();
    } finally {
      await cleanup();
    }
  });
  it("worker rescans the current watchlist after deletion, rather than resurrecting a removed source", async () => {
    const { store, config, cleanup } = await testStore();
    try {
      await store.putEntity(
        config.OWNER_ID,
        "channel",
        config.OWNED_CHANNEL_ID,
        { title: "Fixture" },
        envelope(null, "youtube_data_api").meta,
      );
      const yt = new YouTube(store, config),
        sync = vi.spyOn(yt, "syncChannel");
      await store.removeChannel(config.OWNER_ID, config.OWNED_CHANNEL_ID);
      await new Application(store, config, yt).call(
        { owner: config.OWNER_ID, role: "worker" },
        "sync_all",
        {},
      );
      expect(sync).not.toHaveBeenCalled();
    } finally {
      await cleanup();
    }
  });
});
