import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { AppError, type Json, type Meta } from "../../domain/src/index.js";

export interface Entity {
  id: string;
  owner_id: string;
  kind: string;
  body: Record<string, Json>;
  version: number;
  meta: Meta;
  expires_at: string | null;
  updated_at: string;
}
export interface Observation {
  id: string;
  entity_id: string;
  kind: string;
  data: Record<string, Json>;
  meta: Meta;
  observed_at: string;
  expires_at: string | null;
}
export interface Connection {
  owner_id: string;
  channel_id: string;
  scopes: string[];
  encrypted: string;
  version: number;
  status: string;
  verified_at: string;
}
export interface Session {
  owner_id: string;
  csrf: string;
  expires_at: string;
}
const migration = `
CREATE TABLE IF NOT EXISTS users(id uuid PRIMARY KEY,password_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions(token_hash text PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf text NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_states(state_hash text PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,session_hash text NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,encrypted text NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_connections(owner_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,channel_id text NOT NULL,scopes jsonb NOT NULL,encrypted text NOT NULL,version int NOT NULL DEFAULT 1,status text NOT NULL,verified_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS entities(owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind text NOT NULL,id text NOT NULL,body jsonb NOT NULL,version int NOT NULL DEFAULT 1,meta jsonb NOT NULL,expires_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner_id,kind,id));
CREATE INDEX IF NOT EXISTS entities_expiry ON entities(expires_at);
CREATE TABLE IF NOT EXISTS observations(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,entity_id text NOT NULL,kind text NOT NULL,data jsonb NOT NULL,meta jsonb NOT NULL,observed_at timestamptz NOT NULL,expires_at timestamptz,dedupe_key text NOT NULL,UNIQUE(owner_id,kind,dedupe_key));
CREATE INDEX IF NOT EXISTS observations_lookup ON observations(owner_id,entity_id,kind,observed_at);
CREATE TABLE IF NOT EXISTS quota_ledger(project text NOT NULL,day_pt text NOT NULL,bucket text NOT NULL,units int NOT NULL,PRIMARY KEY(project,day_pt,bucket));
CREATE TABLE IF NOT EXISTS quota_calls(id bigserial PRIMARY KEY,project text NOT NULL,day_pt text NOT NULL,bucket text NOT NULL,method text NOT NULL,at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS deliveries(id text PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,blueprint_id text NOT NULL,revision int NOT NULL,payload jsonb NOT NULL,payload_hash text NOT NULL,target text NOT NULL,state text NOT NULL,attempts int NOT NULL DEFAULT 0,expires_at timestamptz NOT NULL,response jsonb,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS action_approvals(token_hash text PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,session_hash text NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,blueprint_id text NOT NULL,revision int NOT NULL,payload_hash text NOT NULL,target text NOT NULL,expires_at timestamptz NOT NULL,consumed boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS audit_log(id bigserial PRIMARY KEY,owner_id uuid REFERENCES users(id) ON DELETE CASCADE,operation text NOT NULL,entity_id text,at timestamptz NOT NULL DEFAULT now());
`;
const consentMigration = `
CREATE TABLE policy_consents(owner_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,version text NOT NULL,accepted_at timestamptz NOT NULL DEFAULT now(),agent_data_allowed boolean NOT NULL DEFAULT false);
`;
const ownerExpiryMigration = `
UPDATE observations SET expires_at=observed_at+interval '30 days' WHERE kind LIKE 'owned_%' AND expires_at IS NULL;
UPDATE entities SET expires_at=updated_at+interval '30 days' WHERE kind IN ('report','report_job','owner_channel') AND expires_at IS NULL;
`;
export class Store {
  readonly pool: Pool;
  readonly db: ReturnType<typeof drizzle>;
  constructor(url: string) {
    this.pool = new Pool({
      connectionString: url,
      max: 8,
      connectionTimeoutMillis: 5000,
    });
    this.db = drizzle(this.pool);
  }
  async close() {
    await this.pool.end();
  }
  async exclusive<T>(key: string, work: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("SELECT pg_advisory_lock(hashtextextended($1,0))", [
        key,
      ]);
      return await work();
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [
        key,
      ]);
      client.release();
    }
  }
  async migrate() {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(873142)`);
      await tx.execute(
        sql`CREATE TABLE IF NOT EXISTS migrations(version int PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())`,
      );
      for (const [version, source] of [
        [1, migration],
        [2, consentMigration],
        [3, ownerExpiryMigration],
      ] as const) {
        const checksum = createHash("sha256").update(source).digest("hex");
        const old = await tx.execute(
          sql`SELECT checksum FROM migrations WHERE version=${version}`,
        );
        if (old.rows.length) {
          if (old.rows[0]?.checksum !== checksum)
            throw new Error("Migration checksum mismatch");
          continue;
        }
        await tx.execute(sql.raw(source));
        await tx.execute(
          sql`INSERT INTO migrations(version,checksum) VALUES(${version},${checksum})`,
        );
      }
    });
  }
  async initializeOwner(id: string, hash: string) {
    await this.db.execute(
      sql`INSERT INTO users(id,password_hash) VALUES(${id},${hash}) ON CONFLICT DO NOTHING`,
    );
  }
  async passwordHash(id: string) {
    const r = await this.db.execute(
      sql`SELECT password_hash FROM users WHERE id=${id}`,
    );
    return r.rows[0]?.password_hash as string | undefined;
  }
  async policyConsent(owner: string) {
    const result = await this.db.execute(
      sql`SELECT version,accepted_at::text,agent_data_allowed FROM policy_consents WHERE owner_id=${owner}`,
    );
    return result.rows[0] as
      | { version: string; accepted_at: string; agent_data_allowed: boolean }
      | undefined;
  }
  async acceptPolicy(
    owner: string,
    version: string,
    agentDataAllowed: boolean,
  ) {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`INSERT INTO policy_consents(owner_id,version,agent_data_allowed) VALUES(${owner},${version},${agentDataAllowed}) ON CONFLICT(owner_id) DO UPDATE SET version=excluded.version,accepted_at=now(),agent_data_allowed=excluded.agent_data_allowed`,
      );
      await tx.execute(
        sql`INSERT INTO audit_log(owner_id,operation,entity_id) VALUES(${owner},'policy_accepted',${version})`,
      );
    });
  }
  async setAgentDataAllowed(owner: string, version: string, allowed: boolean) {
    const result = await this.db.execute(
      sql`UPDATE policy_consents SET agent_data_allowed=${allowed} WHERE owner_id=${owner} AND version=${version} RETURNING owner_id`,
    );
    if (!result.rows.length)
      throw new AppError("POLICY_ACCEPTANCE_REQUIRED", 403);
    await this.db.execute(
      sql`INSERT INTO audit_log(owner_id,operation) VALUES(${owner},${allowed ? "agent_sharing_enabled" : "agent_sharing_disabled"})`,
    );
  }
  async putSession(hash: string, owner: string, csrf: string, expiry: Date) {
    await this.db.execute(
      sql`INSERT INTO sessions VALUES(${hash},${owner},${csrf},${expiry.toISOString()})`,
    );
  }
  async session(hash: string): Promise<Session | undefined> {
    const r = await this.db.execute(
      sql`SELECT owner_id,csrf,expires_at::text FROM sessions WHERE token_hash=${hash} AND expires_at>now()`,
    );
    return r.rows[0] as unknown as Session | undefined;
  }
  async endSession(hash: string) {
    await this.db.execute(sql`DELETE FROM sessions WHERE token_hash=${hash}`);
  }
  async putOAuthState(
    hash: string,
    owner: string,
    session: string,
    encrypted: string,
  ) {
    await this.db.execute(
      sql`INSERT INTO oauth_states VALUES(${hash},${owner},${session},${encrypted},now()+interval '10 minutes')`,
    );
  }
  async consumeOAuthState(hash: string, session: string) {
    const r = await this.db.execute(
      sql`DELETE FROM oauth_states WHERE state_hash=${hash} AND session_hash=${session} AND expires_at>now() RETURNING encrypted,owner_id`,
    );
    return r.rows[0] as { encrypted: string; owner_id: string } | undefined;
  }
  async connection(owner: string): Promise<Connection | undefined> {
    const r = await this.db.execute(
      sql`SELECT *,verified_at::text FROM oauth_connections WHERE owner_id=${owner}`,
    );
    return r.rows[0] as unknown as Connection | undefined;
  }
  async saveConnection(
    owner: string,
    channel: string,
    scopes: string[],
    encrypted: string,
    expectedVersion?: number,
  ) {
    if (expectedVersion !== undefined) {
      const r = await this.db.execute(
        sql`UPDATE oauth_connections SET encrypted=${encrypted},scopes=${JSON.stringify(scopes)}::jsonb,version=version+1,verified_at=now(),status='connected' WHERE owner_id=${owner} AND version=${expectedVersion} RETURNING version`,
      );
      if (!r.rows.length)
        throw new AppError("TOKEN_ROTATION_CONFLICT", 409, true);
    } else
      await this.db.execute(
        sql`INSERT INTO oauth_connections(owner_id,channel_id,scopes,encrypted,status) VALUES(${owner},${channel},${JSON.stringify(scopes)}::jsonb,${encrypted},'connected') ON CONFLICT(owner_id) DO UPDATE SET channel_id=excluded.channel_id,scopes=excluded.scopes,encrypted=excluded.encrypted,status='connected',version=oauth_connections.version+1,verified_at=now()`,
      );
  }
  async disconnect(owner: string) {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`DELETE FROM oauth_connections WHERE owner_id=${owner}`,
      );
      await tx.execute(
        sql`DELETE FROM observations WHERE owner_id=${owner} AND kind LIKE 'owned_%'`,
      );
      await tx.execute(
        sql`DELETE FROM entities WHERE owner_id=${owner} AND kind IN ('report','report_job','owner_channel')`,
      );
      await tx.execute(sql`DELETE FROM oauth_states WHERE owner_id=${owner}`);
      await tx.execute(
        sql`INSERT INTO audit_log(owner_id,operation) VALUES(${owner},'google_disconnected')`,
      );
    });
  }
  async putEntity(
    owner: string,
    kind: string,
    id: string,
    body: Record<string, Json>,
    meta: Meta,
    expires: Date | null = null,
    expectedVersion?: number,
  ): Promise<Entity> {
    const result =
      expectedVersion !== undefined
        ? await this.db.execute(
            sql`UPDATE entities SET body=${JSON.stringify(body)}::jsonb,meta=${JSON.stringify(meta)}::jsonb,version=version+1,expires_at=${expires?.toISOString() ?? null},updated_at=now() WHERE owner_id=${owner} AND kind=${kind} AND id=${id} AND version=${expectedVersion} RETURNING *,updated_at::text,expires_at::text`,
          )
        : await this.db.execute(
            sql`INSERT INTO entities(owner_id,kind,id,body,meta,expires_at) VALUES(${owner},${kind},${id},${JSON.stringify(body)}::jsonb,${JSON.stringify(meta)}::jsonb,${expires?.toISOString() ?? null}) ON CONFLICT(owner_id,kind,id) DO UPDATE SET body=excluded.body,meta=excluded.meta,expires_at=excluded.expires_at,version=entities.version+1,updated_at=now() RETURNING *,updated_at::text,expires_at::text`,
          );
    if (!result.rows.length) throw new AppError("REVISION_CONFLICT", 409);
    return result.rows[0] as unknown as Entity;
  }
  async entity(
    owner: string,
    kind: string,
    id: string,
  ): Promise<Entity | undefined> {
    const r = await this.db.execute(
      sql`SELECT *,updated_at::text,expires_at::text FROM entities WHERE owner_id=${owner} AND kind=${kind} AND id=${id} AND (expires_at IS NULL OR expires_at>now())`,
    );
    return r.rows[0] as unknown as Entity | undefined;
  }
  async entities(owner: string, kind: string, limit = 200): Promise<Entity[]> {
    const r = await this.db.execute(
      sql`SELECT *,updated_at::text,expires_at::text FROM entities WHERE owner_id=${owner} AND kind=${kind} AND (expires_at IS NULL OR expires_at>now()) ORDER BY entities.updated_at DESC,id LIMIT ${Math.min(limit, 1000)}`,
    );
    return r.rows as unknown as Entity[];
  }
  async consumeGrant(owner: string, id: string) {
    const r = await this.db.execute(
      sql`DELETE FROM entities WHERE owner_id=${owner} AND kind='agent_grant' AND id=${id} AND expires_at>now() RETURNING body`,
    );
    return r.rows[0]?.body as Record<string, Json> | undefined;
  }
  async removeChannel(owner: string, id: string) {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`DELETE FROM entities WHERE owner_id=${owner} AND kind='watchlist' AND id=${id}`,
      );
      await tx.execute(
        sql`DELETE FROM observations WHERE owner_id=${owner} AND (entity_id=${id} OR entity_id IN (SELECT id FROM entities WHERE owner_id=${owner} AND kind='video' AND body->>'channel_id'=${id}))`,
      );
      await tx.execute(
        sql`DELETE FROM entities WHERE owner_id=${owner} AND ((kind='channel' AND id=${id}) OR (kind IN ('video','embedding','candidate') AND body->>'channel_id'=${id}))`,
      );
    });
  }
  async observe(
    owner: string,
    entity: string,
    kind: string,
    data: Record<string, Json>,
    meta: Meta,
    at: Date,
    key: string,
    expires: Date | null = null,
  ) {
    await this.db.execute(
      sql`INSERT INTO observations(id,owner_id,entity_id,kind,data,meta,observed_at,dedupe_key,expires_at) VALUES(${randomUUID()},${owner},${entity},${kind},${JSON.stringify(data)}::jsonb,${JSON.stringify(meta)}::jsonb,${at.toISOString()},${key},${expires?.toISOString() ?? null}) ON CONFLICT(owner_id,kind,dedupe_key) DO UPDATE SET data=excluded.data,meta=excluded.meta,observed_at=excluded.observed_at,expires_at=excluded.expires_at WHERE observations.observed_at<=excluded.observed_at`,
    );
  }
  async observations(
    owner: string,
    entity: string,
    kind: string,
  ): Promise<Observation[]> {
    const r = await this.db.execute(
      sql`SELECT *,observed_at::text,expires_at::text FROM observations WHERE owner_id=${owner} AND entity_id=${entity} AND kind=${kind} AND (expires_at IS NULL OR expires_at>now()) ORDER BY observations.observed_at DESC LIMIT 1000`,
    );
    return r.rows as unknown as Observation[];
  }
  async reserveQuota(
    project: string,
    day: string,
    bucket: string,
    method: string,
    limit: number,
  ) {
    await this.db.transaction(async (tx) => {
      const r = await tx.execute(
        sql`INSERT INTO quota_ledger VALUES(${project},${day},${bucket},1) ON CONFLICT(project,day_pt,bucket) DO UPDATE SET units=quota_ledger.units+1 WHERE quota_ledger.units<${limit} RETURNING units`,
      );
      if (!r.rows.length)
        throw new AppError("QUOTA_BUDGET_EXHAUSTED", 429, false);
      await tx.execute(
        sql`INSERT INTO quota_calls(project,day_pt,bucket,method) VALUES(${project},${day},${bucket},${method})`,
      );
    });
  }
  async quota(project: string, day: string) {
    const r = await this.db.execute(
      sql`SELECT bucket,units FROM quota_ledger WHERE project=${project} AND day_pt=${day}`,
    );
    return r.rows as { bucket: string; units: number }[];
  }
  async purge(now = new Date()) {
    await this.db.transaction(async (tx) => {
      const at = now.toISOString();
      await tx.execute(sql`DELETE FROM entities WHERE expires_at<=${at}`);
      await tx.execute(sql`DELETE FROM observations WHERE expires_at<=${at}`);
      await tx.execute(sql`DELETE FROM sessions WHERE expires_at<=${at}`);
      await tx.execute(sql`DELETE FROM oauth_states WHERE expires_at<=${at}`);
      await tx.execute(
        sql`DELETE FROM action_approvals WHERE expires_at<=${at}`,
      );
      await tx.execute(
        sql`UPDATE deliveries SET state='approval_expired',payload='{}'::jsonb WHERE expires_at<=${at} AND state IN ('queued','retry')`,
      );
    });
  }
  async exportData(owner: string) {
    const entities = await this.db.execute(
      sql`SELECT kind,id,body,version,meta,expires_at::text,updated_at::text FROM entities WHERE owner_id=${owner} AND kind<>'agent_grant' AND (expires_at IS NULL OR expires_at>now())`,
    );
    const observations = await this.db.execute(
      sql`SELECT entity_id,kind,data,meta,observed_at::text,expires_at::text,dedupe_key FROM observations WHERE owner_id=${owner} AND (expires_at IS NULL OR expires_at>now())`,
    );
    return { entities: entities.rows, observations: observations.rows };
  }
  async deleteData(owner: string) {
    await this.db.transaction(async (tx) => {
      for (const table of [
        "entities",
        "observations",
        "oauth_connections",
        "oauth_states",
        "deliveries",
        "action_approvals",
        "audit_log",
        "sessions",
        "policy_consents",
      ])
        await tx.execute(
          sql`DELETE FROM ${sql.identifier(table)} WHERE owner_id=${owner}`,
        );
    });
  }
}
