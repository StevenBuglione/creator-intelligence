import { readFile, writeFile } from "node:fs/promises";
type Entry = {
  feature_id: string;
  actual_status: string;
  implementation_link: string | null;
  test_name: string | null;
  unavailable_reason: string | null;
  compliance_gate: string | null;
  availability: string;
  phase: string;
};
const ledger = JSON.parse(
  await readFile("feature_coverage.json", "utf8"),
) as Entry[];
const groups: {
  ids: string[];
  status: string;
  implementation: string;
  tests: string;
  reason?: string;
}[] = [
  {
    ids: ["CI-011", "CI-012"],
    status: "live_verified",
    implementation: "packages/youtube/src/index.ts",
    tests: "tests/providers.test.ts; scripts/verify-google.ts",
    reason:
      "Real public reads verified with the new restricted key. No earlier history inferred.",
  },
  {
    ids: ["CI-039", "CI-041"],
    status: "tested",
    implementation: "packages/intelligence/src/index.ts",
    tests: "tests/providers.test.ts; tests/recovery.test.ts",
    reason:
      "Watchlist has manual priority; visible recent uploads are bounded to 200 per sync. No derived ranking.",
  },
  {
    ids: ["CI-053"],
    status: "tested",
    implementation: "apps/api/src/server.ts",
    tests:
      "tests/policy.test.ts; tests/providers.test.ts; tests/negative.test.ts",
    reason:
      "Dedicated web client created; JSON download and human consent are pending. Existing MCP authorization is separate evidence.",
  },
  {
    ids: [
      "CI-054",
      "CI-055",
      "CI-056",
      "CI-058",
      "CI-059",
      "CI-060",
      "CI-061",
      "CI-062",
      "CI-072",
    ],
    status: "demo_verified",
    implementation: "packages/youtube/src/index.ts; apps/web/app/page.tsx",
    tests: "tests/providers.test.ts; tests/e2e/workspace.spec.ts",
    reason:
      "Deterministic owner fixtures and reporting parser tested. New-app live owner consent remains pending; provider suppression/lag is explicit.",
  },
  {
    ids: ["CI-024"],
    status: "implemented",
    implementation: "packages/intelligence/src/index.ts",
    tests: "tests/workflow.test.ts",
    reason:
      "Save is tested; state supports saved/dismissed/revisit. Complete dismiss/restore UI is outside the chosen slice.",
  },
  {
    ids: ["CI-077"],
    status: "tested",
    implementation: "packages/ai/src/index.ts",
    tests: "tests/privacy.test.ts",
    reason:
      "Local model JSON validation tested with deterministic responses; actual model output quality is not live verified.",
  },
  {
    ids: ["CI-098", "CI-099", "CI-115", "CI-142"],
    status: "demo_verified",
    implementation:
      "packages/intelligence/src/index.ts; packages/contentos/src/index.ts; apps/web/app/page.tsx",
    tests:
      "tests/workflow.test.ts; tests/recovery.test.ts; tests/e2e/workspace.spec.ts",
    reason:
      "Manual/Claude-authored original drafts and local versioning work. Exact ContentOS contract tested via fixture/HTTP receiver; real production receiver and credentials unverified. Sharing is local MCP/JSON, not public hosting.",
  },
  {
    ids: ["CI-100"],
    status: "in_progress",
    implementation: "apps/web/app/page.tsx; apps/mcp/src/server.ts",
    tests: "tests/workflow.test.ts; tests/e2e/workspace.spec.ts",
    reason:
      "Manual script editing, Claude-authored draft schema and versioning are implemented. Dedicated script-generation/rewriting workflow is not implemented; the optional model currently suggests creative angles.",
  },
  {
    ids: ["CI-140", "CI-141"],
    status: "tested",
    implementation:
      "apps/mcp/src/server.ts; apps/api/src/server.ts; packages/intelligence/src/client.ts",
    tests: "tests/workflow.test.ts; scripts/verify-stack.ts",
    reason:
      "HTTP and stdio handshakes passed. Claude registration was rejected by enterprise MCP policy; administrator allowlisting is required.",
  },
];
for (const e of ledger) {
  if (e.availability === "G") {
    e.actual_status = "not_started";
    e.compliance_gate = "DERIVED_METRIC_APPROVAL_REQUIRED";
    e.unavailable_reason =
      "No genuine accepted Google evidence. All protected endpoints and MCP equivalents fail closed; no derived collector is enabled.";
    continue;
  }
  const group = groups.find((g) => g.ids.includes(e.feature_id));
  if (group) {
    e.actual_status = group.status;
    e.implementation_link = group.implementation;
    e.test_name = group.tests;
    e.unavailable_reason = group.reason ?? null;
  } else if (e.actual_status === "not_started")
    e.unavailable_reason =
      e.availability === "X"
        ? "Unavailable through the permitted official API scope; not fabricated."
        : "Outside the P0 plus selected P1 vertical slice; not implemented.";
}
await writeFile(
  "feature_coverage.json",
  JSON.stringify(ledger, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      features: ledger.length,
      status_counts: Object.fromEntries(
        [...new Set(ledger.map((e) => e.actual_status))].map((s) => [
          s,
          ledger.filter((e) => e.actual_status === s).length,
        ]),
      ),
    },
    null,
    2,
  ),
);
