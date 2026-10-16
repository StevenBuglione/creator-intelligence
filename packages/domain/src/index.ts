import { z } from "zod";

export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };
export type Source =
  | "youtube_data_api"
  | "youtube_analytics_api"
  | "youtube_reporting_api"
  | "user_input"
  | "local_model"
  | "system"
  | "synthetic";
export interface Meta {
  source: Source;
  retrieved_at: string | null;
  classification:
    | "official"
    | "user_authored"
    | "model_generated"
    | "synthetic"
    | "not_available";
  ownership:
    | "owner_authorized"
    | "third_party_public"
    | "user_authored"
    | "system"
    | "synthetic";
  coverage: string;
  limitations: string[];
  not_available: string | null;
  stale: boolean;
}
export interface Envelope<T> {
  data: T;
  meta: Meta;
}
export function envelope<T>(
  data: T,
  source: Source,
  options: Partial<Meta> = {},
): Envelope<T> {
  return {
    data,
    meta: {
      source,
      retrieved_at: new Date().toISOString(),
      classification:
        source === "synthetic"
          ? "synthetic"
          : source === "user_input"
            ? "user_authored"
            : source === "local_model"
              ? "model_generated"
              : "official",
      ownership:
        source === "youtube_data_api"
          ? "third_party_public"
          : ["youtube_analytics_api", "youtube_reporting_api"].includes(source)
            ? "owner_authorized"
            : source === "synthetic"
              ? "synthetic"
              : source === "user_input"
                ? "user_authored"
                : "system",
      coverage: "observed sample",
      limitations: [],
      not_available: null,
      stale: false,
      ...options,
    },
  };
}
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public retryable = false,
  ) {
    super(code);
  }
}
export const channelId = z.string().regex(/^UC[\w-]{22}$/);
export const videoId = z.string().regex(/^[\w-]{11}$/);
export const uuid = z.string().uuid();
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !Number.isNaN(Date.parse(v)));
export const format = z.enum([
  "youtube_long_form",
  "youtube_shorts",
  "unknown",
]);
export const reference = z
  .object({
    provenance: z
      .enum([
        "user_selected_reference",
        "official_public_metadata",
        "user_authored",
      ])
      .default("user_selected_reference"),
    url: z.string().url().max(2000),
    video_id: videoId.optional(),
    note: z.string().max(2000).default(""),
  })
  .strict();
export const ideaInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    angle: z.string().max(4000).default(""),
    format: format.default("youtube_long_form"),
    state: z.enum(["saved", "dismissed", "revisit"]).default("saved"),
    references: z.array(reference).max(30).default([]),
  })
  .strict();
export const blueprintInput = z
  .object({
    idea_id: uuid.optional(),
    working_title: z.string().trim().min(1).max(200),
    title_variants: z.array(z.string().min(1).max(200)).max(10).default([]),
    target_format: format.exclude(["unknown"]),
    target_duration_seconds: z.number().int().min(10).max(3600),
    hook: z.string().max(10000),
    outline: z.array(z.string().max(5000)).min(1).max(50),
    research_sources: z.array(reference).max(30),
    thumbnail_brief: z.string().max(10000),
    script: z.string().max(100000).default(""),
    risk_flags: z.array(z.string().max(1000)).max(30).default([]),
  })
  .strict();
export type Blueprint = z.infer<typeof blueprintInput> & {
  id: string;
  revision: number;
};
export const scopes = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];
export function validateScopes(granted: string[]) {
  if (
    !scopes.every((s) => granted.includes(s)) ||
    granted.some((s) => !scopes.includes(s))
  )
    throw new AppError("READ_ONLY_SCOPE_MISMATCH", 403);
}
export function ensureOwner(actual: string, expected: string) {
  if (actual !== expected) throw new AppError("OWNER_MISMATCH", 403);
}
export function assertUngoverned(operation: string) {
  if (
    [
      "outliers",
      "compare_competitors",
      "observed_vph",
      "derived_scores",
      "extended_public_history",
    ].includes(operation)
  )
    throw new AppError("DERIVED_METRIC_APPROVAL_REQUIRED", 403);
}
