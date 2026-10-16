import { z } from "zod";
import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  unlink,
  stat,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Store } from "../../db/src/index.js";
import { AppError, type Json, type Meta } from "../../domain/src/index.js";
import { seal, unseal } from "./index.js";
const meta = z.object({
  ownership: z
    .enum([
      "owner_authorized",
      "third_party_public",
      "user_authored",
      "system",
      "synthetic",
    ])
    .default("system"),
  source: z.enum([
    "youtube_data_api",
    "youtube_analytics_api",
    "youtube_reporting_api",
    "user_input",
    "local_model",
    "system",
    "synthetic",
  ]),
  retrieved_at: z.string().nullable(),
  classification: z.enum([
    "official",
    "user_authored",
    "model_generated",
    "synthetic",
    "not_available",
  ]),
  coverage: z.string(),
  limitations: z.array(z.string()),
  not_available: z.string().nullable(),
  stale: z.boolean(),
});
const document = z.object({
  version: z.literal(1),
  created_at: z.string().datetime(),
  owner: z.string().uuid(),
  data: z.object({
    entities: z.array(
      z.object({
        kind: z.enum([
          "channel",
          "video",
          "idea",
          "blueprint",
          "blueprint_revision",
          "embedding",
          "candidate",
          "report",
          "report_job",
          "experiment",
          "performance_link",
          "watchlist",
        ]),
        id: z.string(),
        body: z.record(z.string(), z.unknown()),
        version: z.number().int().positive(),
        meta,
        expires_at: z.string().nullable(),
        updated_at: z.string(),
      }),
    ),
    observations: z.array(
      z.object({
        entity_id: z.string(),
        kind: z.string(),
        data: z.record(z.string(), z.unknown()),
        meta,
        observed_at: z.string(),
        expires_at: z.string().nullable(),
        dedupe_key: z.string(),
      }),
    ),
  }),
});
export async function encryptedBackup(
  store: Store,
  owner: string,
  key: string,
) {
  const exported = await store.exportData(owner);
  // Provider caches and private analytics are re-collected after reconnection.
  // Keeping them out of backups makes source expiry and revocation effective.
  const data = {
    entities: exported.entities.filter(
      (row) => (row.meta as Meta).source === "user_input",
    ),
    observations: [],
  };
  return seal(
    {
      version: 1,
      created_at: new Date().toISOString(),
      owner,
      data,
    },
    key,
    "creator-intelligence-backup:" + owner,
  );
}
export async function restoreBackup(
  store: Store,
  owner: string,
  key: string,
  encrypted: string,
) {
  const backup = document.parse(
    unseal(encrypted, key, "creator-intelligence-backup:" + owner),
  );
  if (backup.owner !== owner) throw new AppError("BACKUP_OWNER_MISMATCH", 403);
  return store.exclusive(`owner:${owner}`, async () => {
    const current = await store.exportData(owner);
    if (current.entities.length || current.observations.length)
      throw new AppError("RESTORE_REQUIRES_EMPTY_WORKSPACE", 409);
    let restored = 0;
    const now = Date.now();
    for (const e of backup.data.entities) {
      if (e.expires_at && Date.parse(e.expires_at) <= now) continue;
      if (e.meta.source === "youtube_data_api" && !e.expires_at) continue;
      await store.putEntity(
        owner,
        e.kind,
        e.id,
        e.body as Record<string, Json>,
        e.meta as Meta,
        e.expires_at ? new Date(e.expires_at) : null,
      );
      await store.db.execute(
        sql`UPDATE entities SET version=${e.version},updated_at=${e.updated_at} WHERE owner_id=${owner} AND kind=${e.kind} AND id=${e.id}`,
      );
      restored++;
    }
    for (const o of backup.data.observations) {
      if (o.expires_at && Date.parse(o.expires_at) <= now) continue;
      if (o.meta.source === "youtube_data_api" && !o.expires_at) continue;
      await store.observe(
        owner,
        o.entity_id,
        o.kind,
        o.data as Record<string, Json>,
        o.meta as Meta,
        new Date(o.observed_at),
        o.dedupe_key,
        o.expires_at ? new Date(o.expires_at) : null,
      );
      restored++;
    }
    return { restored, google_connection: "reconnect_required" };
  });
}

// Only this application's exact owner-prefixed files are managed here. Operator
// exports/manual backups are never silently removed by retention or deletion.
async function managedFiles(directory: string, owner: string) {
  z.string().uuid().parse(owner);
  const root = resolve(directory);
  const files = await readdir(root).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  return files
    .filter(
      (name) =>
        name.startsWith(`drafts-${owner}-`) &&
        /^drafts-[a-f0-9-]{36}-[0-9TZ-]+-[a-f0-9-]{36}\.encrypted$/.test(name),
    )
    .map((name) => join(root, name));
}
export async function clearManagedBackups(directory: string, owner: string) {
  const files = await managedFiles(directory, owner);
  for (const file of files) await unlink(file);
  return files.length;
}
export async function backupAndIntegrity(
  store: Store,
  owner: string,
  key: string,
  directory: string,
  retentionDays = 7,
) {
  const root = resolve(directory);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const name = `drafts-${owner}-${new Date().toISOString().replaceAll(":", "-").replace(".", "-")}-${randomUUID()}.encrypted`;
  const path = join(root, name);
  await writeFile(path, await encryptedBackup(store, owner, key), {
    flag: "wx",
    mode: 0o600,
  });
  // Read from disk and authenticate/decode the complete saved document. The DB
  // restore drill is separately exercised by the integration suite.
  const verified = document.parse(
    unseal(
      await readFile(path, "utf8"),
      key,
      "creator-intelligence-backup:" + owner,
    ),
  );
  for (const file of await managedFiles(root, owner)) {
    if (
      file !== path &&
      (await stat(file)).mtimeMs < Date.now() - retentionDays * 86400_000
    )
      await unlink(file);
  }
  return {
    file: name,
    integrity: "verified",
    original_records: verified.data.entities.length,
    provider_records: 0,
  };
}
