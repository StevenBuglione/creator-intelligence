import { spawnSync } from "node:child_process";
const env = { ...process.env, NODE_ENV: "production" };
for (const [script, args] of [
  ["node_modules/typescript/bin/tsc", ["-p", "tsconfig.build.json"]],
  ["node_modules/next/dist/bin/next", ["build", "apps/web"]],
] as const) {
  const result = spawnSync(process.execPath, [script, ...args], {
    stdio: "inherit",
    env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
