import { Pool } from "pg";
import { getConfig } from "../packages/config/src/index.js";
import { Store } from "../packages/db/src/index.js";
import { envelope } from "../packages/domain/src/index.js";
import { hashPassword } from "../packages/security/src/index.js";
import { publicExpiry } from "../packages/youtube/src/quota.js";
export async function demoData() {
  const live = getConfig(),
    url = new URL(live.DATABASE_URL);
  url.pathname = "/creator_intelligence_demo";
  const admin = new Pool({ connectionString: live.DATABASE_URL });
  try {
    await admin.query("CREATE DATABASE creator_intelligence_demo");
  } catch (error) {
    if ((error as { code?: string }).code !== "42P04") throw error;
  } finally {
    await admin.end();
  }
  const config = {
    ...live,
    DATABASE_URL: url.href,
    APP_MODE: "demo" as const,
    APP_ORIGIN: "http://localhost:4410",
    API_ORIGIN: "http://localhost:4411",
    PORT: 4411,
    GOOGLE_CLIENT_ID: undefined,
    GOOGLE_CLIENT_SECRET: undefined,
    YOUTUBE_DATA_API_KEY: undefined,
    CONTENTOS_API_URL: undefined,
    CONTENTOS_SERVICE_TOKEN: undefined,
    CONTENTOS_LOCAL_INBOX: process.cwd() + "/data/demo-inbox",
  };
  const store = new Store(config.DATABASE_URL);
  await store.migrate();
  // This dedicated database is disposable fixture data, never the live workspace.
  await store.deleteData(config.OWNER_ID);
  await store.initializeOwner(
    config.OWNER_ID,
    hashPassword(config.OWNER_PASSWORD!),
  );
  const meta = envelope(null, "synthetic", {
      coverage: "Deterministic offline demonstration. Not real channel data.",
    }).meta,
    owner = config.OWNER_ID,
    now = new Date();
  await store.putEntity(
    owner,
    "channel",
    "UC0000000000000000000000",
    {
      title: "Fixture channel",
      tracking_since: now.toISOString(),
      statistics: { viewCount: "1200" },
    },
    meta,
    publicExpiry(now),
  );
  await store.putEntity(
    owner,
    "video",
    "fixture0001",
    {
      title: "A fictional lunchbox experiment",
      channel_id: "UC0000000000000000000000",
      format: "unknown",
      statistics: { viewCount: "1200" },
    },
    meta,
    publicExpiry(now),
  );
  const reports = {
    overview: [
      {
        day: "2026-10-01",
        views: 1200,
        engagedViews: 800,
        estimatedMinutesWatched: 500,
        averageViewDuration: 25,
        subscribersGained: 10,
        subscribersLost: 2,
      },
      {
        day: "2026-10-02",
        views: 1500,
        engagedViews: 1000,
        estimatedMinutesWatched: 650,
        averageViewDuration: 26,
        subscribersGained: 12,
        subscribersLost: 1,
      },
    ],
    traffic: [
      {
        insightTrafficSourceType: "SHORTS",
        views: 900,
        estimatedMinutesWatched: 400,
      },
      {
        insightTrafficSourceType: "YT_SEARCH",
        views: 300,
        estimatedMinutesWatched: 100,
      },
    ],
    retention: [
      {
        elapsedVideoTimeRatio: 0,
        audienceWatchRatio: 1,
        relativeRetentionPerformance: 0.5,
      },
      {
        elapsedVideoTimeRatio: 0.5,
        audienceWatchRatio: 0.7,
        relativeRetentionPerformance: 0.6,
      },
      {
        elapsedVideoTimeRatio: 1,
        audienceWatchRatio: 0.4,
        relativeRetentionPerformance: null,
      },
    ],
  };
  for (const [kind, rows] of Object.entries(reports))
    await store.observe(
      owner,
      kind === "retention" ? "fixture0001" : config.OWNED_CHANNEL_ID,
      "owned_" + kind,
      { rows },
      meta,
      now,
      "demo-" + kind,
    );
  await store.observe(
    owner,
    "fixture0001",
    "owned_reach",
    { date: "20261001", impressions: 1000, ctr: 0.042 },
    meta,
    now,
    "demo-reach",
  );
  return { config, store };
}
