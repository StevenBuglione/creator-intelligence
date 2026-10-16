import type { z } from "zod";
import {
  AppError,
  type Envelope,
  blueprintInput,
  ideaInput,
} from "../../domain/src/index.js";
import type { Entity, Observation } from "../../db/src/index.js";
export class CreatorClient {
  private origin: URL;
  constructor(
    url: string,
    readonly auth: { bearer?: string; csrf?: string; cookie?: string },
    readonly transport: typeof fetch = fetch,
  ) {
    this.origin = new URL(url);
    if (
      this.origin.protocol !== "https:" &&
      !["localhost", "127.0.0.1", "api"].includes(this.origin.hostname)
    )
      throw new Error("API requires HTTPS outside local deployment");
  }
  async invoke<T = unknown>(
    operation: string,
    input: Record<string, unknown> = {},
  ): Promise<Envelope<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.auth.bearer) headers.Authorization = `Bearer ${this.auth.bearer}`;
    if (this.auth.csrf) headers["X-CSRF-Token"] = this.auth.csrf;
    if (this.auth.cookie) headers.Cookie = this.auth.cookie;
    const response = await this.transport(
      new URL(
        "/api/v1/operations/" + encodeURIComponent(operation),
        this.origin,
      ),
      {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(input),
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      },
    );
    const result = (await response.json()) as Envelope<T> & {
      error?: { code: string; retryable: boolean };
    };
    if (!response.ok)
      throw new AppError(
        result.error?.code ?? "API_UNAVAILABLE",
        response.status,
        result.error?.retryable ?? false,
      );
    return result;
  }
  channels() {
    return this.invoke<Entity[]>("channels");
  }
  videos(channel_id?: string) {
    return this.invoke<Entity[]>("videos", channel_id ? { channel_id } : {});
  }
  ideas() {
    return this.invoke<Entity[]>("ideas");
  }
  blueprint(id: string) {
    return this.invoke<Entity>("blueprint", { id });
  }
  analytics(
    kind: "overview" | "traffic" | "retention" | "reach",
    video_id?: string,
  ) {
    return this.invoke<Observation[]>("analytics", {
      kind,
      ...(video_id ? { video_id } : {}),
    });
  }
  exportBlueprint(id: string, revision: number) {
    return this.invoke("blueprint_export", { id, revision });
  }
  saveIdea(body: z.input<typeof ideaInput>, authorization: string) {
    return this.invoke<Entity>("idea_save", { body, authorization });
  }
  saveBlueprint(
    body: z.input<typeof blueprintInput>,
    authorization: string,
    id?: string,
    version?: number,
  ) {
    return this.invoke<Entity>("blueprint_save", {
      body,
      authorization,
      ...(id ? { id, version } : {}),
    });
  }
}
