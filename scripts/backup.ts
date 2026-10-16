import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { getConfig } from "../packages/config/src/index.js";
import { Store } from "../packages/db/src/index.js";
import {
  encryptedBackup,
  restoreBackup,
} from "../packages/security/src/backup.js";
import { hashPassword } from "../packages/security/src/index.js";
const config = getConfig(),
  restore = process.argv[2] === "restore",
  url = new URL(config.DATABASE_URL);
if (restore) {
  url.pathname = "/creator_intelligence_restore";
  const admin = new Pool({ connectionString: config.DATABASE_URL });
  try {
    await admin.query("CREATE DATABASE creator_intelligence_restore");
  } catch (e) {
    if ((e as { code?: string }).code !== "42P04") throw e;
  } finally {
    await admin.end();
  }
}
const store = new Store(url.href);
try {
  await store.migrate();
  if (restore) {
    if (!process.argv[3]) throw new Error("Encrypted backup path required");
    await store.initializeOwner(
      config.OWNER_ID,
      hashPassword(config.OWNER_PASSWORD!),
    );
    console.log(
      await restoreBackup(
        store,
        config.OWNER_ID,
        config.APP_ENCRYPTION_KEY,
        await readFile(resolve(process.argv[3]), "utf8"),
      ),
    );
  } else {
    await mkdir("backups", { recursive: true });
    const path = `backups/workspace-${new Date().toISOString().replaceAll(":", "-")}.encrypted`;
    await writeFile(
      path,
      await encryptedBackup(store, config.OWNER_ID, config.APP_ENCRYPTION_KEY),
      { mode: 0o600, flag: "wx" },
    );
    console.log("Encrypted workspace backup saved: " + path);
  }
} finally {
  await store.close();
}
