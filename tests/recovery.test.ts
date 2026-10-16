import { describe, it, expect, vi } from "vitest";
import { Application } from "../packages/intelligence/src/index.js";
import { YouTube } from "../packages/youtube/src/index.js";
import { envelope, type Envelope } from "../packages/domain/src/index.js";
import type { Entity } from "../packages/db/src/index.js";
import { testStore } from "./helpers.js";
describe("durable recovery", () => {
  it("records manual variant periods without claiming randomized exposure", async () => {
    const { store, config, cleanup } = await testStore();
    try {
      const app = new Application(store, config),
        actor = { owner: config.OWNER_ID, role: "owner" as const };
      await app.call(actor, "experiment_save", {
        video_id: "aaaaaaaaaaa",
        variant_name: "Title A",
        title: "An original title",
        thumbnail_note: "Original art",
        starts_at: "2026-10-01T00:00:00Z",
        ends_at: "2026-10-02T00:00:00Z",
      });
      const rows = (await app.call(actor, "experiments")) as Envelope<Entity[]>;
      expect(rows.data).toHaveLength(1);
      expect(rows.meta.limitations.join(" ")).toContain("not randomized");
    } finally {
      await cleanup();
    }
  });
  it("retains a watchlist ID after metadata expiry and honors manual priority", async () => {
    const { store, config, cleanup } = await testStore();
    try {
      const yt = new YouTube(store, config),
        order: string[] = [];
      vi.spyOn(yt, "syncChannel").mockImplementation(async (_owner, id) => {
        order.push(id);
        return { channel_id: id, videos: 0, coverage: "fixture" };
      });
      for (const [id, priority] of [
        ["low", 8],
        ["high", 1],
      ] as const)
        await store.putEntity(
          config.OWNER_ID,
          "watchlist",
          id,
          { priority },
          envelope(null, "user_input").meta,
        );
      await new Application(store, config, yt).call(
        { owner: config.OWNER_ID, role: "worker" },
        "sync_all",
        {},
      );
      expect(order).toEqual(["high", "low"]);
      await store.removeChannel(config.OWNER_ID, "high");
      expect(
        await store.entity(config.OWNER_ID, "watchlist", "high"),
      ).toBeUndefined();
    } finally {
      await cleanup();
    }
  });
  it("does not overwrite corrected reach data with an older report", async () => {
    const { store, config, cleanup } = await testStore();
    try {
      const meta = envelope(null, "youtube_reporting_api").meta;
      await store.observe(
        config.OWNER_ID,
        "aaaaaaaaaaa",
        "owned_reach",
        { impressions: 200 },
        meta,
        new Date("2026-10-02"),
        "same-dimensions",
      );
      await store.observe(
        config.OWNER_ID,
        "aaaaaaaaaaa",
        "owned_reach",
        { impressions: 100 },
        meta,
        new Date("2026-10-01"),
        "same-dimensions",
      );
      const rows = await store.observations(
        config.OWNER_ID,
        "aaaaaaaaaaa",
        "owned_reach",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.data.impressions).toBe(200);
    } finally {
      await cleanup();
    }
  });
});
