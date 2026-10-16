import { spawn } from "node:child_process";
// PostgreSQL/Redis are started with Compose; these foreground processes use the
// same private environment as the production stack, on the same local ports.
const commands = [
  ["--import", "tsx", "apps/api/src/main.ts"],
  ["--import", "tsx", "apps/worker/src/main.ts"],
  ["--import", "tsx", "apps/mcp/src/http.ts"],
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "apps/web",
    "--hostname",
    "127.0.0.1",
    "--port",
    "4310",
  ],
];
const children = commands.map((args) =>
  spawn(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  }),
);
let stopping = false;
function stop(code: number) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const child of children) child.once("exit", (code) => stop(code ?? 1));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
