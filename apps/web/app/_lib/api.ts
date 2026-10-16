export type PolicyState = {
  version: string;
  accepted: boolean;
  accepted_at: string | null;
  agent_data_allowed: boolean;
};
export type Meta = {
  source: string;
  ownership?: string;
  retrieved_at: string;
  stale: boolean;
  not_available?: string | null;
  coverage?: string;
};
export type Row = {
  id: string;
  version: number;
  body: Record<string, unknown>;
  meta: Meta;
  updated_at: string;
  expires_at?: string | null;
};
export type Observation = {
  data: {
    rows?: Record<string, unknown>[];
    impressions?: number;
    ctr?: number;
    date?: string;
  };
  meta: Meta;
  observed_at?: string;
};
export type Status = {
  mode?: string;
  google?: {
    connected?: boolean;
    configured?: boolean;
    channel_id?: string | null;
    verified_at?: string | null;
  };
  public_api_configured?: boolean;
  publishing?: string;
  derived_metrics?: {
    enabled?: boolean;
    reason?: string;
    application_url?: string;
  };
  quota?: {
    day_pt?: string;
    resets_at?: string;
    usage?: Record<string, unknown>[];
    coverage?: string;
  };
};
export type Draft = {
  idea_id: string | undefined;
  working_title: string;
  target_format: string;
  target_duration_seconds: number;
  hook: string;
  outline: string[];
  research_sources: { url: string; note: string }[];
  thumbnail_brief: string;
  script: string;
  risk_flags: string[];
  title_variants: string[];
};
export const emptyDraft: Draft = {
  idea_id: undefined,
  working_title: "",
  target_format: "youtube_shorts",
  target_duration_seconds: 60,
  hook: "",
  outline: [""],
  research_sources: [],
  thumbnail_brief: "",
  script: "",
  risk_flags: [],
  title_variants: [],
};

export const API =
  process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:4311";

export const pages = [
  { name: "Overview", group: "Evidence", icon: "overview" },
  { name: "My channel", group: "Evidence", icon: "channel" },
  { name: "Research", group: "Evidence", icon: "research" },
  { name: "Channels", group: "Evidence", icon: "channels" },
  { name: "Ideas", group: "Create", icon: "idea" },
  { name: "Blueprints", group: "Create", icon: "blueprint" },
  { name: "Settings", group: "Workspace", icon: "settings" },
] as const;
export type PageName = (typeof pages)[number]["name"];

export const pageIntro: Record<PageName, string> = {
  Overview:
    "Where your research, ideas and blueprints stand, with the latest stored channel report.",
  "My channel":
    "Owner-authorized YouTube Analytics and Reporting records, exactly as stored.",
  Research:
    "Raw public records from tracked channels. Format remains unknown unless the source establishes it. No competitor scores or rankings.",
  Channels:
    "Public channels you follow for research. Their records refresh or expire within 30 days.",
  Ideas: "Original angles, each linked to the sources that inspired it.",
  Blueprints:
    "Versioned production plans. Each saved revision can be exported as local JSON.",
  Settings: "Consent, MCP sharing, Google access, quota and your data.",
};

/** Plain-language explanations for API error codes. The code stays visible. */
const errorText: Record<string, string> = {
  LOGIN_FAILED: "That password was not accepted.",
  LOGIN_REQUIRED: "Your session has ended. Sign in again.",
  CSRF_REJECTED: "The request could not be verified. Reload and try again.",
  RATE_LIMITED: "Too many requests. Wait a minute and try again.",
  INVALID_INPUT: "Some fields are missing or invalid.",
  INTERNAL_ERROR: "The local service could not complete the request.",
  NOT_FOUND: "The record was not found.",
  POLICY_ACCEPTANCE_REQUIRED:
    "The privacy policy or terms changed. Review them to continue.",
  PUBLIC_API_KEY_NOT_CONFIGURED:
    "Public lookups need this installation's own YouTube Data API key.",
  CHANNEL_NOT_FOUND_OR_PRIVATE: "That channel is unknown, private or deleted.",
  VIDEO_NOT_FOUND_OR_PRIVATE: "That video is unknown, private or deleted.",
  UPLOADS_PLAYLIST_UNAVAILABLE: "This channel's uploads are not available.",
  VIDEO_REQUIRED: "Enter a video ID for retention and reach reports.",
  VIDEO_OWNER_MISMATCH: "That video does not belong to your owner channel.",
  GOOGLE_NOT_CONNECTED: "Connect your owner channel in Settings first.",
  GOOGLE_REAUTH_REQUIRED: "Google access expired. Reconnect in Settings.",
  GOOGLE_CLIENT_NOT_CONFIGURED: "This installation has no Google OAuth client.",
  GOOGLE_QUOTA_EXHAUSTED: "The daily YouTube quota is exhausted.",
  QUOTA_BUDGET_EXHAUSTED: "The configured quota budget is used up for today.",
  GOOGLE_RETRY_LATER: "YouTube asked to retry later.",
  GOOGLE_NETWORK_UNAVAILABLE: "YouTube could not be reached.",
  GOOGLE_REQUEST_FAILED: "YouTube returned an error.",
  REVISION_CONFLICT:
    "This blueprint changed since you opened it. Reload it before saving.",
  DERIVED_METRIC_APPROVAL_REQUIRED:
    "Derived metrics stay disabled without YouTube approval.",
  LOCAL_MODEL_NOT_CONFIGURED_USE_MANUAL_EDITOR:
    "No local model is configured. Write the angle yourself.",
  LOCAL_MODEL_UNAVAILABLE: "The local model is not responding.",
  LOCAL_MODEL_OUTPUT_INVALID: "The local model returned unusable output.",
  LOCAL_MODEL_ANGLES_NOT_DISTINCT:
    "The local model's angles were not distinct enough.",
  GOOGLE_PROJECT_REVOCATION_UNCONFIRMED: "Revocation was not confirmed.",
  DIRECT_OWNER_APPROVAL_REQUIRED:
    "This action needs the owner's direct approval.",
  INVALID_DRAFT_JSON: "The draft request is not valid JSON.",
};
export function describeError(code: string) {
  return errorText[code] ?? "The request did not complete.";
}

export function humanize(key: string) {
  const spaced = key
    .replaceAll("_", " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const m = Math.floor(seconds / 60),
    s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatLabel(format: unknown) {
  return format === "youtube_shorts"
    ? "Shorts"
    : format === "youtube_long_form"
      ? "Long form"
      : format === "unknown" || format == null
        ? "Format unknown"
        : String(format);
}

export function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
