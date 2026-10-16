import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
// Always rebuild generated server code so removed modules cannot remain executable.
rmSync(new URL("../dist/", import.meta.url), { recursive: true, force: true });
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
