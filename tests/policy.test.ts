import { describe, it, expect } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import {
  assertUngoverned,
  validateScopes,
  scopes,
  envelope,
} from "../packages/domain/src/index.js";
import { seal, unseal, pkce, digest } from "../packages/security/src/index.js";
import { Application } from "../packages/intelligence/src/index.js";
import { YouTube } from "../packages/youtube/src/index.js";
import { testStore, blueprint } from "./helpers.js";
describe("fail closed policy", () => {
  it("rejects derived scores even if an environment flag says approved", () => {
    process.env.DERIVED_METRICS_APPROVED = "true";
    for (const op of [
      "outliers",
      "compare_competitors",
      "observed_vph",
      "derived_scores",
      "extended_public_history",
    ])
      expect(() => assertUngoverned(op)).toThrow(
        "DERIVED_METRIC_APPROVAL_REQUIRED",
      );
    delete process.env.DERIVED_METRICS_APPROVED;
  });
  it("rejects broad scopes, wrong encryption owner, and tampering", () => {
    expect(() =>
      validateScopes([
        ...scopes,
        "https://www.googleapis.com/auth/youtube.upload",
      ]),
    ).toThrow();
    expect(() => validateScopes([scopes[0]!])).toThrow();
    validateScopes(scopes);
    const key = randomBytes(32).toString("base64"),
      encrypted = seal({ token: "private" }, key, "one");
    expect(encrypted).not.toContain("private");
    expect(unseal(encrypted, key, "one")).toEqual({ token: "private" });
    expect(() => unseal(encrypted, key, "two")).toThrow();
    const pair = pkce();
    expect(pair.verifier.length).toBeGreaterThanOrEqual(43);
    expect(pair.challenge).not.toBe(pair.verifier);
  });
  it("enforces owner, agent action authorization, and source URL restrictions", async () => {
    const { store, config, cleanup } = await testStore();
    try {
      const app = new Application(store, config);
      await expect(
        app.call({ owner: randomUUID(), role: "owner" }, "ideas"),
      ).rejects.toThrow("OWNER_MISMATCH");
      await expect(
        app.call({ owner: config.OWNER_ID, role: "agent" }, "approve", {
          id: randomUUID(),
        }),
      ).rejects.toThrow("DIRECT_OWNER_APPROVAL_REQUIRED");
      await expect(
        app.call({ owner: config.OWNER_ID, role: "agent" }, "blueprint_save", {
          body: blueprint,
        }),
      ).rejects.toThrow("DIRECT_OWNER_APPROVAL_REQUIRED");
      await expect(
        new YouTube(store, config).request("https://www.youtube.com/watch", {}),
      ).rejects.toThrow("PROVIDER_URL_NOT_ALLOWED");
    } finally {
      await cleanup();
    }
  });
  it("purges expired public source text, snapshots and embeddings while keeping original blueprints", async () => {
    const { store, config, cleanup } = await testStore();
    try {
      const owner = config.OWNER_ID,
        meta = envelope(null, "youtube_data_api").meta,
        old = new Date(Date.now() - 1000);
      for (const kind of ["channel", "video", "embedding"])
        await store.putEntity(
          owner,
          kind,
          "source",
          { title: "untrusted old source" },
          meta,
          old,
        );
      await store.observe(
        owner,
        "source",
        "public_video",
        { views: 1200 },
        meta,
        old,
        "old",
        old,
      );
      await store.putEntity(
        owner,
        "blueprint",
        randomUUID(),
        blueprint,
        envelope(null, "user_input").meta,
      );
      expect(await store.entities(owner, "video")).toHaveLength(0);
      await store.purge();
      expect(
        (
          await store.pool.query(
            "SELECT count(*)::int AS n FROM entities WHERE owner_id=$1 AND expires_at IS NOT NULL",
            [owner],
          )
        ).rows[0].n,
      ).toBe(0);
      expect(await store.entities(owner, "blueprint")).toHaveLength(1);
      expect(
        await store.observations(owner, "source", "public_video"),
      ).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });
  it("consumes OAuth state only for its bound live session and only once", async () => {
    const { store, config, cleanup } = await testStore();
    try {
      await store.putSession(
        "session",
        config.OWNER_ID,
        "csrf",
        new Date(Date.now() + 10000),
      );
      await store.putOAuthState(
        digest("state"),
        config.OWNER_ID,
        "session",
        "encrypted",
      );
      expect(
        await store.consumeOAuthState(digest("state"), "other"),
      ).toBeUndefined();
      expect(
        await store.consumeOAuthState(digest("state"), "session"),
      ).toMatchObject({ owner_id: config.OWNER_ID });
      expect(
        await store.consumeOAuthState(digest("state"), "session"),
      ).toBeUndefined();
    } finally {
      await cleanup();
    }
  });
});
