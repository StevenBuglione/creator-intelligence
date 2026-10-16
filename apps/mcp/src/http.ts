import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { equal } from "../../../packages/security/src/index.js";
import { apiInvoke, createMcp } from "./server.js";
const token = process.env.MCP_TOKEN;
if (!token || token.length < 32) throw new Error("MCP_TOKEN required");
const invoke = apiInvoke(
  process.env.CI_API_INTERNAL ?? "http://localhost:4311",
  token,
);
const app = createServer(async (req, res) => {
  const host = req.headers.host?.split(":")[0];
  if (
    req.headers.origin ||
    !host ||
    !["localhost", "127.0.0.1", "mcp"].includes(host)
  ) {
    res.writeHead(403).end();
    return;
  }
  if (req.url === "/healthz") {
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end('{"status":"ok"}');
    return;
  }
  if (!equal(req.headers.authorization ?? "", `Bearer ${token}`)) {
    res.writeHead(401).end();
    return;
  }
  if (req.url !== "/mcp" || req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 150000) {
      res.writeHead(413).end();
      return;
    }
    chunks.push(Buffer.from(chunk));
  }
  const server = createMcp(invoke),
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(
      req,
      res,
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
  } catch {
    if (!res.headersSent)
      res.writeHead(400).end('{"error":"INVALID_MCP_REQUEST"}');
  }
});
app.listen(4312, process.env.HOST ?? "127.0.0.1", () =>
  console.log("Creator Intelligence MCP ready on port 4312"),
);
