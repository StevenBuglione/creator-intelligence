import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { apiInvoke, createMcp } from "./server.js";
if (!process.env.MCP_TOKEN) throw new Error("MCP_TOKEN required");
const server = createMcp(
  apiInvoke(
    process.env.CI_API_INTERNAL ?? "http://localhost:4311",
    process.env.MCP_TOKEN,
  ),
);
await server.connect(new StdioServerTransport());
