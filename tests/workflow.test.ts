import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { Application } from "../packages/intelligence/src/index.js";
import { createServer } from "../apps/api/src/server.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcp } from "../apps/mcp/src/server.js";
import { testStore, blueprint } from "./helpers.js";
import type { Envelope } from "../packages/domain/src/index.js";
import type { Entity } from "../packages/db/src/index.js";
describe("owner-reviewed production workflow", () => {
  it("delivers one project per revision with concurrent clicks; rejects a changed approval", async () => {
    const { store, config, cleanup } = await testStore(),
      inbox = await mkdtemp(join(tmpdir(), "ci-test-inbox-"));
    config.CONTENTOS_LOCAL_INBOX = inbox;
    try {
      const application = new Application(store, config),
        owner = config.OWNER_ID;
      await store.putSession(
        "owner-session",
        owner,
        "csrf",
        new Date(Date.now() + 3600000),
      );
      const actor = {
        owner,
        role: "owner" as const,
        sessionHash: "owner-session",
      };
      const saved = (await application.call(actor, "blueprint_save", {
        body: blueprint,
      })) as Envelope<Entity>;
      const approval = (await application.call(actor, "approve", {
        id: saved.data.id,
        revision: 1,
      })) as Envelope<{ approval: string }>;
      await Promise.all(
        Array.from({ length: 5 }, () =>
          application.call(actor, "send", {
            id: saved.data.id,
            approval: approval.data.approval,
          }),
        ),
      );
      expect(await readdir(inbox)).toHaveLength(1);
      expect(await store.deliveries(owner)).toHaveLength(1);
      expect((await store.deliveries(owner))[0]?.state).toBe("delivered");
      expect((await store.deliveries(owner))[0]?.payload).toMatchObject({
        event_type: "creator_intelligence.blueprint.approved.v1",
        source_app: "creator-intelligence",
        idempotency_key: `approved-blueprint:${saved.data.id}:1`,
        research_sources: [
          {
            url: blueprint.research_sources[0]!.url,
            provenance: "user_selected_reference",
          },
        ],
      });
      const revised = (await application.call(actor, "blueprint_save", {
        id: saved.data.id,
        version: 1,
        body: { ...blueprint, hook: "Different hook" },
      })) as Envelope<Entity>;
      expect(revised.data.version).toBe(2);
      await expect(
        application.call(actor, "send", {
          id: saved.data.id,
          approval: approval.data.approval,
        }),
      ).rejects.toThrow("DIRECT_OWNER_APPROVAL_REQUIRED");
      const second = (await application.call(actor, "approve", {
        id: saved.data.id,
        revision: 2,
      })) as Envelope<{ approval: string }>;
      await application.call(actor, "send", {
        id: saved.data.id,
        approval: second.data.approval,
      });
      expect(await readdir(inbox)).toHaveLength(2);
      expect(await store.entities(owner, "blueprint_revision")).toHaveLength(2);
    } finally {
      await cleanup();
      await rm(inbox, { recursive: true });
    }
  });
  it("leaves absent target queued and never claims an external project", async () => {
    const { store, config, cleanup } = await testStore();
    delete config.CONTENTOS_API_URL;
    delete config.CONTENTOS_LOCAL_INBOX;
    try {
      const app = new Application(store, config),
        actor = {
          owner: config.OWNER_ID,
          role: "owner" as const,
          sessionHash: "s",
        };
      await store.putSession(
        "s",
        actor.owner,
        "c",
        new Date(Date.now() + 100000),
      );
      const saved = (await app.call(actor, "blueprint_save", {
        body: blueprint,
      })) as Envelope<Entity>;
      const approval = (await app.call(actor, "approve", {
        id: saved.data.id,
        revision: 1,
      })) as Envelope<{ approval: string }>;
      await app.call(actor, "send", {
        id: saved.data.id,
        approval: approval.data.approval,
      });
      expect((await store.deliveries(actor.owner))[0]).toMatchObject({
        state: "queued",
        target: "disconnected",
        response: null,
      });
    } finally {
      await cleanup();
    }
  });
  it("authenticates REST, rejects CSRF/origins and hides secrets on errors", async () => {
    const { store, config } = await testStore(),
      app = await createServer(config, store);
    try {
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/operations/status",
            payload: {},
          })
        ).statusCode,
      ).toBe(401);
      const login = await app.inject({
        method: "POST",
        url: "/api/v1/login",
        headers: { origin: config.APP_ORIGIN },
        payload: { password: config.OWNER_PASSWORD },
      });
      expect(login.statusCode).toBe(200);
      expect(login.headers["set-cookie"]).toContain("HttpOnly");
      const cookie = String(login.headers["set-cookie"]).split(";")[0]!,
        csrf = login.json().data.csrf;
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/operations/status",
            headers: { cookie, origin: config.APP_ORIGIN },
            payload: {},
          })
        ).statusCode,
      ).toBe(403);
      const status = await app.inject({
        method: "POST",
        url: "/api/v1/operations/status",
        headers: { cookie, origin: config.APP_ORIGIN, "x-csrf-token": csrf },
        payload: {},
      });
      expect(status.statusCode).toBe(200);
      expect(status.body).not.toContain(config.MCP_TOKEN);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/operations/approve",
            headers: { authorization: `Bearer ${config.MCP_TOKEN}` },
            payload: { id: randomUUID() },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            url: "/healthz",
            headers: { host: "attacker.example" },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/login",
            headers: { origin: "https://attacker.example" },
            payload: { password: config.OWNER_PASSWORD },
          })
        ).statusCode,
      ).toBe(403);
    } finally {
      await store.pool.query("DELETE FROM users WHERE id=$1", [
        config.OWNER_ID,
      ]);
      await app.close();
    }
  });
  it("MCP returns the same stored data and refuses unauthorized mutation", async () => {
    const { store, config, cleanup } = await testStore(),
      app = new Application(store, config),
      actor = { owner: config.OWNER_ID, role: "agent" as const },
      server = createMcp((op, input) => app.call(actor, op, input)),
      client = new Client({ name: "test", version: "1" }),
      [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const list = await client.listTools();
      expect(list.tools.some((t) => t.name === "creator_analytics")).toBe(true);
      const result = await client.callTool({
        name: "creator_ideas",
        arguments: { input: {} },
      });
      expect(
        JSON.parse((result.content as { text: string }[])[0]!.text).data,
      ).toEqual(((await app.call(actor, "ideas")) as Envelope<Entity[]>).data);
      const blocked = await client.callTool({
        name: "creator_blueprint_save",
        arguments: { input: { body: blueprint } },
      });
      expect(blocked.isError).toBe(true);
      expect(JSON.stringify(blocked)).toContain(
        "DIRECT_OWNER_APPROVAL_REQUIRED",
      );
      await store.putSession(
        "mcp-approved-draft",
        config.OWNER_ID,
        "csrf",
        new Date(Date.now() + 100000),
      );
      const grant = (await app.call(
        {
          owner: config.OWNER_ID,
          role: "owner",
          sessionHash: "mcp-approved-draft",
        },
        "agent_authorize",
        { operation: "blueprint_save", input: { body: blueprint } },
      )) as Envelope<{ authorization: string }>;
      const savedThroughMcp = await client.callTool({
        name: "creator_blueprint_save",
        arguments: {
          input: { body: blueprint, authorization: grant.data.authorization },
        },
      });
      expect(savedThroughMcp.isError).not.toBe(true);
      expect(await store.entities(config.OWNER_ID, "blueprint")).toHaveLength(
        1,
      );
      const gate = await client.callTool({
        name: "creator_outliers",
        arguments: { input: {} },
      });
      expect(JSON.stringify(gate)).toContain(
        "DERIVED_METRIC_APPROVAL_REQUIRED",
      );
    } finally {
      await client.close();
      await server.close();
      await cleanup();
    }
  });
  it("exact draft authorization is single-use and cannot authorize a different payload", async () => {
    const { store, config, cleanup } = await testStore();
    try {
      const app = new Application(store, config),
        owner = {
          owner: config.OWNER_ID,
          role: "owner" as const,
          sessionHash: "grant-s",
        },
        agent = { owner: config.OWNER_ID, role: "agent" as const };
      await store.putSession(
        "grant-s",
        owner.owner,
        "c",
        new Date(Date.now() + 100000),
      );
      const input = { body: blueprint };
      const grant = (await app.call(owner, "agent_authorize", {
        operation: "blueprint_save",
        input,
      })) as Envelope<{ authorization: string }>;
      await app.call(agent, "blueprint_save", {
        ...input,
        authorization: grant.data.authorization,
      });
      await expect(
        app.call(agent, "blueprint_save", {
          ...input,
          authorization: grant.data.authorization,
        }),
      ).rejects.toThrow("DIRECT_OWNER_APPROVAL_REQUIRED");
      expect(await store.entities(owner.owner, "blueprint")).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });
});
