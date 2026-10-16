import { Queue, Worker, UnrecoverableError } from "bullmq";
import { Redis } from "ioredis";
import { AppError } from "../../../packages/domain/src/index.js";
import { apiInvoke } from "../../mcp/src/server.js";
if (!process.env.WORKER_TOKEN) throw new Error("WORKER_TOKEN required");
const connection = new Redis(
    process.env.REDIS_URL ?? "redis://127.0.0.1:6438",
    { maxRetriesPerRequest: null },
  ),
  queue = new Queue("creator-intelligence", { connection });
const invoke = apiInvoke(
  process.env.CI_API_INTERNAL ?? "http://localhost:4311",
  process.env.WORKER_TOKEN,
);
const worker = new Worker(
  "creator-intelligence",
  async (job) => {
    try {
      return await invoke(job.name, {});
    } catch (error) {
      if (error instanceof AppError && [401, 403, 429].includes(error.status))
        throw new UnrecoverableError(error.code);
      throw new Error(
        error instanceof AppError ? error.code : "SERVICE_UNAVAILABLE",
      );
    }
  },
  { connection, concurrency: 1 },
);
worker.on("error", () => console.error("Worker connection unavailable"));
worker.on("failed", (job) =>
  console.error(
    `Worker job ${job?.name ?? "unknown"} failed; inspect service health`,
  ),
);
for (const [name, every] of [
  ["purge", 3600000],
  ["drain", 60000],
  ["sync_all", 6 * 3600000],
  ["backup_and_integrity", 24 * 3600000],
] as const)
  await queue.upsertJobScheduler(
    name,
    { every },
    {
      name,
      opts: {
        attempts: 3,
        backoff: { type: "exponential", delay: 60000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    },
  );
console.log("Creator Intelligence worker ready");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    void (async () => {
      await worker.close();
      await queue.close();
      await connection.quit();
      process.exit(0);
    })();
  });
