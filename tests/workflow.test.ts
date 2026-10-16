import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { Application } from "../packages/intelligence/src/index.js";
import { createServer } from "../apps/api/src/server.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcp } from "../apps/mcp/src/server.js";
import { testStore, blueprint } from "./helpers.js";
import type { Envelope } from "../packages/domain/src/index.js";
import type { Entity } from "../packages/db/src/index.js";
describe("standalone blueprint workflow", () => {
  it("exports the requested blueprint revision locally and rejects stale revisions", async () => {
    const { store, config, cleanup } = await testStore();
    try {
      const app = new Application(store, config),
        actor = { owner: config.OWNER_ID, role: "owner" as const };
      const saved = (await app.call(actor, "blueprint_save", {
        body: blueprint,
      })) as Envelope<Entity>;
      const exported = await app.call(actor, "blueprint_export", {
        id: saved.data.id,
        revision: 1,
      });
      expect(exported.data).toMatchObject({
        schema_version: "creator_intelligence.blueprint.v1",
        blueprint_id: saved.data.id,
        revision: 1,
        blueprint: {
          working_title: blueprint.working_title,
          research_sources: blueprint.research_sources,
        },
      });
      await app.call(actor, "blueprint_save", {
        id: saved.data.id,
        version: 1,
        body: { ...blueprint, hook: "New hook" },
      });
      await expect(
        app.call(actor, "blueprint_export", { id: saved.data.id, revision: 1 }),
      ).rejects.toThrow("REVISION_CONFLICT");
      expect(
        await store.entities(config.OWNER_ID, "blueprint_revision"),
      ).toHaveLength(2);
      const updated = await app.call(
        { ...actor, role: "agent" },
        "blueprint_export",
        { id: saved.data.id, revision: 2 },
      );
      expect(updated.data).toMatchObject({
        revision: 2,
        blueprint: { hook: "New hook" },
      });
    } finally {
      await cleanup();
    }
  });
  it("has no outbound production operations, even for the owner", async () => {
    const { store, config, cleanup } = await testStore();
    try {
      const app = new Application(store, config);
      for (const operation of ["approve", "send", "drain", "deliveries"])
        await expect(
          app.call({ owner: config.OWNER_ID, role: "owner" }, operation, {}),
        ).rejects.toThrow("OPERATION_NOT_FOUND");
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
