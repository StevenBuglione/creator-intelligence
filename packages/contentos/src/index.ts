import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AppError, type Json } from "../../domain/src/index.js";
import { digest } from "../../security/src/index.js";
import type { Config } from "../../config/src/index.js";
import type { Store, Entity, Delivery } from "../../db/src/index.js";

export function payloadFor(blueprint: Entity): Record<string, Json> {
  return {
    event_type: "creator_intelligence.blueprint.approved.v1",
    idempotency_key: `approved-blueprint:${blueprint.id}:${blueprint.version}`,
    source_app: "creator-intelligence",
    blueprint_id: blueprint.id,
    revision: blueprint.version,
    ...blueprint.body,
  };
}
export class ContentOS {
  constructor(
    readonly store: Store,
    readonly config: Config,
    readonly transport: typeof fetch = fetch,
  ) {}
  target() {
    return (
      this.config.CONTENTOS_API_URL ??
      (this.config.CONTENTOS_LOCAL_INBOX ? "local_fixture" : "disconnected")
    );
  }
  async deliver(delivery: Delivery) {
    if (delivery.state === "delivered") return delivery;
    if (delivery.target !== this.target()) {
      await this.store.deliveryStatus(delivery.id, "target_changed", null);
      return;
    }
    if (new Date(delivery.expires_at).getTime() <= Date.now()) {
      await this.store.deliveryStatus(delivery.id, "approval_expired", null);
      return;
    }
    if (this.target() === "disconnected") return delivery;
    try {
      let receipt: Record<string, Json>;
      if (this.config.CONTENTOS_LOCAL_INBOX && !this.config.CONTENTOS_API_URL) {
        if (this.config.APP_MODE === "live")
          throw new AppError("FIXTURE_TARGET_FORBIDDEN_IN_LIVE", 403);
        await mkdir(this.config.CONTENTOS_LOCAL_INBOX, { recursive: true });
        const path = join(
          this.config.CONTENTOS_LOCAL_INBOX,
          digest(delivery.id) + ".json",
        );
        receipt = {
          project_id: "fixture-" + digest(delivery.id).slice(0, 20),
          idempotency_key: delivery.id,
          classification: "synthetic",
          payload_hash: delivery.payload_hash,
        };
        try {
          await writeFile(
            path,
            JSON.stringify({ receipt, payload: delivery.payload }),
            { flag: "wx", mode: 0o600 },
          );
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
          const old = JSON.parse(await readFile(path, "utf8")) as {
            receipt: typeof receipt;
          };
          if (old.receipt.payload_hash !== delivery.payload_hash)
            throw new AppError("IDEMPOTENCY_CONFLICT", 409);
          receipt = old.receipt;
        }
      } else {
        const url = new URL(this.config.CONTENTOS_API_URL!);
        if (
          url.protocol !== "https:" &&
          !["localhost", "127.0.0.1"].includes(url.hostname)
        )
          throw new AppError("CONTENTOS_HTTPS_REQUIRED", 403);
        if (!this.config.CONTENTOS_SERVICE_TOKEN)
          throw new AppError("CONTENTOS_CREDENTIALS_REQUIRED", 503);
        const response = await this.transport(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.CONTENTOS_SERVICE_TOKEN}`,
            "Content-Type": "application/json",
            "Idempotency-Key": delivery.id,
          },
          body: JSON.stringify(delivery.payload),
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok)
          throw new AppError(
            "CONTENTOS_UNAVAILABLE",
            502,
            response.status === 429 || response.status >= 500,
          );
        const raw = (await response.json()) as {
          project_id?: unknown;
          idempotency_key?: unknown;
        };
        if (
          typeof raw.project_id !== "string" ||
          raw.idempotency_key !== delivery.id
        )
          throw new AppError("CONTENTOS_RECEIPT_INVALID", 502);
        receipt = {
          project_id: raw.project_id,
          idempotency_key: delivery.id,
          classification: "external_receipt",
        };
      }
      await this.store.deliveryStatus(delivery.id, "delivered", receipt);
    } catch (error) {
      const code =
        error instanceof AppError
          ? error.code
          : "CONTENTOS_NETWORK_UNAVAILABLE";
      const permanent = error instanceof AppError && !error.retryable;
      await this.store.deliveryStatus(
        delivery.id,
        permanent ? "needs_attention" : "retry",
        { error: code },
      );
    }
  }
  async drain(owner: string) {
    return this.store.exclusive(`owner:${owner}`, async () => {
      for (const d of await this.store.deliveries(owner))
        if (["queued", "retry"].includes(d.state)) await this.deliver(d);
      return this.store.deliveries(owner);
    });
  }
}
