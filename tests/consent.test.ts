import { describe, it, expect, vi } from "vitest";
import { testStore } from "./helpers.js";
import { createServer } from "../apps/api/src/server.js";
import { Application } from "../packages/intelligence/src/index.js";
import { POLICY_VERSION } from "../packages/domain/src/policy.js";
import { YouTube } from "../packages/youtube/src/index.js";

describe("versioned privacy consent and MCP sharing", () => {
  it("blocks owner, agent and collection workers before consent while cleanup remains available", async () => {
    const { store, config, cleanup } = await testStore({ acceptPolicy: false });
    const app = new Application(store, config);
    try {
      for (const role of ["owner", "agent", "worker"] as const) {
        await expect(
          app.call({ owner: config.OWNER_ID, role }, "status"),
        ).rejects.toThrow("POLICY_ACCEPTANCE_REQUIRED");
      }
      for (const op of ["sync_all", "drain", "backup_and_integrity"])
        await expect(
          app.call({ owner: config.OWNER_ID, role: "worker" }, op),
        ).rejects.toThrow("POLICY_ACCEPTANCE_REQUIRED");
      await expect(
        app.call({ owner: config.OWNER_ID, role: "worker" }, "purge"),
      ).resolves.toMatchObject({ data: { purged: true } });
      expect(await store.policyConsent(config.OWNER_ID)).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it("requires a CSRF-protected owner session, explicit agreement and the current policy version", async () => {
    const { store, config } = await testStore({ acceptPolicy: false });
    const server = await createServer(config, store);
    try {
      const payload = {
        version: POLICY_VERSION,
        privacy_accepted: true,
        terms_accepted: true,
      };
      for (const token of [config.MCP_TOKEN, config.WORKER_TOKEN]) {
        expect(
          (
            await server.inject({
              method: "POST",
              url: "/api/v1/policy/accept",
              headers: { authorization: `Bearer ${token}` },
              payload,
            })
          ).statusCode,
        ).toBe(403);
      }
      const login = await server.inject({
        method: "POST",
        url: "/api/v1/login",
        headers: { origin: config.APP_ORIGIN },
        payload: { password: config.OWNER_PASSWORD },
      });
      const cookie = String(login.headers["set-cookie"]).split(";")[0]!;
      const headers = {
        origin: config.APP_ORIGIN,
        cookie,
        "x-csrf-token": login.json().data.csrf,
      };
      expect(login.json().data.policy).toMatchObject({
        accepted: false,
        agent_data_allowed: false,
      });
      expect(
        (
          await server.inject({
            method: "POST",
            url: "/api/v1/auth/google/start",
            headers,
            payload: {},
          })
        ).json().error.code,
      ).toBe("POLICY_ACCEPTANCE_REQUIRED");
      expect(
        (
          await server.inject({
            method: "POST",
            url: "/api/v1/policy/accept",
            headers: { ...headers, "x-csrf-token": "wrong" },
            payload,
          })
        ).statusCode,
      ).toBe(403);
      for (const invalid of [
        { ...payload, privacy_accepted: false },
        { ...payload, terms_accepted: false },
        { ...payload, version: "old-version" },
      ])
        expect(
          (
            await server.inject({
              method: "POST",
              url: "/api/v1/policy/accept",
              headers,
              payload: invalid,
            })
          ).statusCode,
        ).toBe(400);
      const accepted = await server.inject({
        method: "POST",
        url: "/api/v1/policy/accept",
        headers,
        payload,
      });
      expect(accepted.statusCode).toBe(200);
      expect(accepted.json().data).toMatchObject({
        accepted: true,
        agent_data_allowed: false,
      });
      expect(
        (await store.policyConsent(config.OWNER_ID))?.accepted_at,
      ).toBeTruthy();
      expect(
        (
          await server.inject({
            method: "POST",
            url: "/api/v1/operations/status",
            headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await server.inject({
            method: "POST",
            url: "/api/v1/operations/status",
            headers: { authorization: `Bearer ${config.MCP_TOKEN}` },
            payload: {},
          })
        ).json().error.code,
      ).toBe("AGENT_DATA_SHARING_NOT_AUTHORIZED");
      expect(
        (
          await server.inject({
            method: "POST",
            url: "/api/v1/policy/agent-data",
            headers,
            payload: { allowed: true },
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await server.inject({
            method: "POST",
            url: "/api/v1/operations/status",
            headers: { authorization: `Bearer ${config.MCP_TOKEN}` },
            payload: {},
          })
        ).statusCode,
      ).toBe(200);
      await server.inject({
        method: "POST",
        url: "/api/v1/policy/agent-data",
        headers,
        payload: { allowed: false },
      });
      expect(
        (
          await server.inject({
            method: "POST",
            url: "/api/v1/operations/status",
            headers: { authorization: `Bearer ${config.MCP_TOKEN}` },
            payload: {},
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await server.inject({ url: "/api/v1/session", headers: { cookie } })
        ).json().data.policy.agent_data_allowed,
      ).toBe(false);
    } finally {
      await store.pool.query("DELETE FROM users WHERE id=$1", [
        config.OWNER_ID,
      ]);
      await server.close();
    }
  });

  it("requires renewed consent for old versions and removes consent when app data is deleted", async () => {
    const { store, config, cleanup } = await testStore();
    try {
      await store.acceptPolicy(config.OWNER_ID, "previous-policy", true);
      const app = new Application(store, config);
      await expect(
        app.call({ owner: config.OWNER_ID, role: "owner" }, "status"),
      ).rejects.toThrow("POLICY_ACCEPTANCE_REQUIRED");
      await expect(
        store.setAgentDataAllowed(config.OWNER_ID, POLICY_VERSION, true),
      ).rejects.toThrow("POLICY_ACCEPTANCE_REQUIRED");
      await store.acceptPolicy(config.OWNER_ID, POLICY_VERSION, false);
      await store.deleteData(config.OWNER_ID);
      expect(await store.policyConsent(config.OWNER_ID)).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it("repeats migrations without changing checksums or auto-accepting policies", async () => {
    const { store, config, cleanup } = await testStore({ acceptPolicy: false });
    try {
      const before = await store.pool.query(
        "SELECT version,checksum FROM migrations ORDER BY version",
      );
      await store.migrate();
      const after = await store.pool.query(
        "SELECT version,checksum FROM migrations ORDER BY version",
      );
      expect(after.rows).toEqual(before.rows);
      expect(after.rows.map((x) => x.version)).toEqual([1, 2, 3]);
      expect(await store.policyConsent(config.OWNER_ID)).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it("keeps MCP reads on stored records and rejects direct Google collection", async () => {
    const { store, config, cleanup } = await testStore();
    const youtube = new YouTube(store, config);
    const request = vi.spyOn(youtube, "request");
    const bearer = vi.spyOn(youtube, "bearer");
    const app = new Application(store, config, youtube);
    const actor = { owner: config.OWNER_ID, role: "agent" as const };
    try {
      for (const operation of [
        "status",
        "channels",
        "videos",
        "analytics",
        "ideas",
        "blueprints",
        "export",
      ])
        await app.call(actor, operation);
      for (const operation of [
        "sync_all",
        "sync_channel",
        "sync_video",
        "analytics_sync",
        "reporting_sync",
      ])
        await expect(app.call(actor, operation)).rejects.toThrow(
          "DIRECT_OWNER_APPROVAL_REQUIRED",
        );
      expect(request).not.toHaveBeenCalled();
      expect(bearer).not.toHaveBeenCalled();
    } finally {
      await cleanup();
    }
  });
});
