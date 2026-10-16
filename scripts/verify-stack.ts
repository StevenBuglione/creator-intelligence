import { mkdir, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { getConfig } from "../packages/config/src/index.js";
const config = getConfig(),
  report: Record<string, unknown> = { at: new Date().toISOString() };
try {
  report.api_health = (await fetch(config.API_ORIGIN + "/healthz")).status;
  report.web = (await fetch(config.APP_ORIGIN)).status;
  report.unauthenticated_api = (
    await fetch(config.API_ORIGIN + "/api/v1/operations/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
  ).status;
  for (const kind of ["http", "stdio"]) {
    const client = new Client({
      name: "creator-intelligence-verifier",
      version: "1",
    });
    const transport =
      kind === "http"
        ? new StreamableHTTPClientTransport(
            new URL("/mcp", process.env.MCP_ORIGIN ?? "http://localhost:4312"),
            {
              requestInit: {
                headers: { Authorization: `Bearer ${config.MCP_TOKEN}` },
              },
            },
          )
        : new StdioClientTransport({
            command: process.execPath,
            args: ["dist/apps/mcp/src/main.js"],
            env: {
              MCP_TOKEN: config.MCP_TOKEN,
              CI_API_INTERNAL: config.API_ORIGIN,
            },
            stderr: "pipe",
          });
    try {
      await client.connect(transport);
      const tools = await client.listTools(),
        status = await client.callTool({
          name: "creator_status",
          arguments: { input: {} },
        }),
        gate = await client.callTool({
          name: "creator_outliers",
          arguments: { input: {} },
        });
      if (status.isError || !gate.isError)
        throw new Error("MCP policy verification failed");
      const names = tools.tools.map((tool) => tool.name);
      if (
        !names.includes("creator_blueprint_export") ||
        names.includes("creator_deliveries")
      )
        throw new Error("MCP standalone export verification failed");
      report["mcp_" + kind] = {
        tools: tools.tools.length,
        read_succeeded: !status.isError,
        derived_metrics_blocked: gate.isError,
        standalone_blueprint_export: true,
      };
    } finally {
      await client.close();
    }
  }
  const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 1 }),
    queue = new Queue("creator-intelligence", { connection });
  try {
    report.redis = await connection.ping();
    report.worker_schedulers = (await queue.getJobSchedulers()).map(
      (j) => j.name,
    );
    if (
      JSON.stringify([...(report.worker_schedulers as string[])].sort()) !==
      JSON.stringify(["backup_and_integrity", "purge", "sync_all"])
    )
      throw new Error("Unexpected worker schedule");
    const completed = await queue.getJobs(["completed"], 0, 99);
    const backup = completed.find((j) => j.name === "backup_and_integrity");
    report.daily_backup = backup?.returnvalue?.data ?? "not_completed_yet";
  } finally {
    await queue.close();
    await connection.quit();
  }
  await mkdir("evidence", { recursive: true });
  await writeFile(
    "evidence/stack-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error("Stack verification failed; no credential details logged.");
  process.exitCode = 1;
}
