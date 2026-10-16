import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  quotaDay,
  quotaReset,
  publicExpiry,
  approvedStatExpiry,
  retryDelay,
  quotaRule,
} from "../packages/youtube/src/quota.js";
import { testStore } from "./helpers.js";
describe("quota calendar and atomic reservation", () => {
  it("resets on Pacific midnight across both DST transitions", () => {
    expect(quotaDay(new Date("2026-03-08T07:59:00Z"))).toBe("2026-03-07");
    expect(quotaReset(new Date("2026-03-08T08:01:00Z"))).toBe(
      "2026-03-09T07:00:00.000Z",
    );
    expect(quotaReset(new Date("2026-11-01T07:01:00Z"))).toBe(
      "2026-11-02T08:00:00.000Z",
    );
    expect(publicExpiry(new Date("2026-01-31T00:00:00Z")).toISOString()).toBe(
      "2026-03-02T00:00:00.000Z",
    );
    expect(
      approvedStatExpiry(new Date("2024-02-29T00:00:00Z")).toISOString(),
    ).toBe("2027-02-28T00:00:00.000Z");
  });
  it("honors full Retry-After and bounded exponential jitter", () => {
    expect(retryDelay(0, "120")).toBe(120000);
    expect(retryDelay(1, null, 0, () => 0)).toBe(1000);
    expect(retryDelay(0, "Thu, 01 Jan 1970 00:02:00 GMT", 0)).toBe(120000);
  });
  it("never overspends under concurrent workers and persists across restart", async () => {
    const { store, config, cleanup } = await testStore();
    const project = randomUUID();
    try {
      const outcomes = await Promise.allSettled(
        Array.from({ length: 20 }, () =>
          store.reserveQuota(project, "2026-10-16", "search", "search.list", 5),
        ),
      );
      expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(5);
      expect((await store.quota(project, "2026-10-16"))[0]?.units).toBe(5);
      expect(quotaRule("search.list", config)).toEqual({
        bucket: "search",
        limit: 90,
      });
      expect(quotaRule("videos.list", config).limit).toBe(9000);
      await store.reserveQuota(
        project,
        "2026-10-17",
        "search",
        "search.list",
        5,
      );
    } finally {
      await store.pool.query("DELETE FROM quota_calls WHERE project=$1", [
        project,
      ]);
      await store.pool.query("DELETE FROM quota_ledger WHERE project=$1", [
        project,
      ]);
      await cleanup();
    }
  });
});
