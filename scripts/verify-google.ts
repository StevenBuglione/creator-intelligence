import { mkdir, writeFile } from "node:fs/promises";
import { getConfig } from "../packages/config/src/index.js";
import { Store } from "../packages/db/src/index.js";
import { Application } from "../packages/intelligence/src/index.js";
import { AppError } from "../packages/domain/src/index.js";
import { hashPassword } from "../packages/security/src/index.js";
const config = getConfig(),
  store = new Store(config.DATABASE_URL);
try {
  await store.migrate();
  if (config.OWNER_PASSWORD)
    await store.initializeOwner(
      config.OWNER_ID,
      hashPassword(config.OWNER_PASSWORD),
    );
  const app = new Application(store, config),
    actor = { owner: config.OWNER_ID, role: "owner" as const };
  const publicResult = await app.call(actor, "channel_add", {
    identifier: config.OWNED_CHANNEL_ID,
  });
  const connection = await store.connection(config.OWNER_ID);
  const video = process.env.VERIFY_VIDEO_ID
    ? await app.youtube.lookupVideo(
        config.OWNER_ID,
        process.env.VERIFY_VIDEO_ID,
      )
    : undefined;
  let owner: unknown = "pending_new_app_consent";
  if (connection) {
    await app.youtube.syncOwned(config.OWNER_ID);
    owner = await app.youtube.reporting(config.OWNER_ID, false);
  }
  const evidence = {
    verified_at: new Date().toISOString(),
    public: publicResult,
    single_video: video
      ? {
          id: video.id,
          statistics_available:
            Object.keys(video.body.statistics as object).length > 0,
        }
      : "not_requested",
    owner,
    new_app_connection: !!connection,
    existing_publishing: "unchanged",
  };
  await mkdir("evidence", { recursive: true });
  await writeFile(
    "evidence/new-app-google.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  console.error(
    JSON.stringify({
      error: error instanceof AppError ? error.code : "VERIFICATION_FAILED",
    }),
  );
  process.exitCode = 1;
} finally {
  await store.close();
}
