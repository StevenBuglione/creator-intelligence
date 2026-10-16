import {
  OAuth2Client,
  CodeChallengeMethod,
  type Credentials,
} from "google-auth-library";
import { parse } from "csv-parse/sync";
import { DateTime } from "luxon";
import {
  AppError,
  envelope,
  scopes,
  validateScopes,
  type Json,
  type Meta,
} from "../../domain/src/index.js";
import {
  digest,
  pkce,
  randomToken,
  seal,
  unseal,
} from "../../security/src/index.js";
import type { Config } from "../../config/src/index.js";
import type { Store } from "../../db/src/index.js";
import { publicExpiry, quotaDay, quotaRule, retryDelay } from "./quota.js";

interface Page {
  items?: Record<string, Json>[];
  nextPageToken?: string;
  summary?: { failedVideoIds?: string[] };
  columnHeaders?: { name: string }[];
  rows?: Json[][];
  reportTypes?: { id: string; name: string }[];
  jobs?: { id: string; reportTypeId: string; name: string }[];
  reports?: { id: string; downloadUrl: string; createTime: string }[];
}
export interface Transport {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}
const normal: Transport = {
  fetch: globalThis.fetch,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
const obj = (v: Json | undefined) =>
  v && typeof v === "object" && !Array.isArray(v) ? v : {};
export function parseReport(csv: string) {
  const rows = parse(csv, {
    columns: true,
    bom: true,
    delimiter: csv.split("\n")[0]?.includes("\t") ? "\t" : ",",
    skip_empty_lines: true,
    max_record_size: 1_000_000,
    relax_column_count: false,
  }) as Record<string, string>[];
  for (const row of rows) {
    if (!/^\d{8}$/.test(row.date ?? "") || !row.video_id || !row.channel_id)
      throw new AppError("REPORT_SCHEMA_UNSUPPORTED", 422);
  }
  return rows;
}
export class YouTube {
  constructor(
    readonly store: Store,
    readonly config: Config,
    readonly io: Transport = normal,
  ) {}
  oauth() {
    if (!this.config.GOOGLE_CLIENT_ID || !this.config.GOOGLE_CLIENT_SECRET)
      throw new AppError("GOOGLE_CLIENT_NOT_CONFIGURED", 503);
    return new OAuth2Client(
      this.config.GOOGLE_CLIENT_ID,
      this.config.GOOGLE_CLIENT_SECRET,
      this.config.GOOGLE_OAUTH_REDIRECT_URI,
    );
  }
  async startOAuth(owner: string, sessionHash: string) {
    const { verifier, challenge } = pkce(),
      state = randomToken();
    await this.store.putOAuthState(
      digest(state),
      owner,
      sessionHash,
      seal({ verifier }, this.config.APP_ENCRYPTION_KEY, owner),
    );
    return this.oauth().generateAuthUrl({
      scope: scopes,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: false,
      state,
      code_challenge: challenge,
      code_challenge_method: CodeChallengeMethod.S256,
    });
  }
  async finishOAuth(state: string, code: string, sessionHash: string) {
    const saved = await this.store.consumeOAuthState(
      digest(state),
      sessionHash,
    );
    if (!saved) throw new AppError("OAUTH_STATE_INVALID_OR_REPLAYED", 403);
    const { verifier } = unseal<{ verifier: string }>(
      saved.encrypted,
      this.config.APP_ENCRYPTION_KEY,
      saved.owner_id,
    );
    const client = this.oauth();
    let tokens: Credentials;
    try {
      tokens = (
        await client.getToken({
          code,
          codeVerifier: verifier,
          redirect_uri: this.config.GOOGLE_OAUTH_REDIRECT_URI,
        })
      ).tokens;
    } catch {
      throw new AppError("OAUTH_EXCHANGE_FAILED", 403);
    }
    const granted = (tokens.scope ?? "").split(" ").filter(Boolean);
    validateScopes(granted);
    if (!tokens.refresh_token || !tokens.access_token)
      throw new AppError("OFFLINE_CONSENT_REQUIRED", 403);
    const channel = await this.request(
      "https://www.googleapis.com/youtube/v3/channels",
      { part: "snippet", mine: "true" },
      tokens.access_token,
      "channels.list",
    );
    if (
      channel.items?.length !== 1 ||
      channel.items[0]?.id !== this.config.OWNED_CHANNEL_ID
    )
      throw new AppError("CHANNEL_MISMATCH", 403);
    await this.store.saveConnection(
      saved.owner_id,
      this.config.OWNED_CHANNEL_ID,
      granted,
      seal(tokens, this.config.APP_ENCRYPTION_KEY, saved.owner_id),
    );
    return saved.owner_id;
  }
  async bearer(owner: string) {
    const conn = await this.store.connection(owner);
    if (!conn || conn.status !== "connected")
      throw new AppError("GOOGLE_NOT_CONNECTED", 401);
    validateScopes(conn.scopes);
    const tokens = unseal<Credentials>(
      conn.encrypted,
      this.config.APP_ENCRYPTION_KEY,
      owner,
    );
    if (tokens.access_token && (tokens.expiry_date ?? 0) > Date.now() + 60_000)
      return tokens.access_token;
    try {
      const client = this.oauth();
      client.setCredentials(tokens);
      const refreshed = (await client.refreshAccessToken()).credentials;
      const merged = {
        ...tokens,
        ...refreshed,
        refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
      };
      validateScopes((merged.scope ?? conn.scopes.join(" ")).split(" "));
      await this.store.saveConnection(
        owner,
        conn.channel_id,
        conn.scopes,
        seal(merged, this.config.APP_ENCRYPTION_KEY, owner),
        conn.version,
      );
      if (!merged.access_token)
        throw new AppError("GOOGLE_REAUTH_REQUIRED", 401);
      return merged.access_token;
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code === "TOKEN_ROTATION_CONFLICT"
      ) {
        const newer = await this.store.connection(owner);
        if (newer) {
          const c = unseal<Credentials>(
            newer.encrypted,
            this.config.APP_ENCRYPTION_KEY,
            owner,
          );
          if (c.access_token && (c.expiry_date ?? 0) > Date.now())
            return c.access_token;
        }
      }
      // Network failures must not be confused with revocation. Only a documented
      // invalid_grant response causes immediate owner-data cleanup.
      const reason = (error as { response?: { data?: { error?: string } } })
        .response?.data?.error;
      if (reason === "invalid_grant") {
        await this.store.disconnect(owner);
        throw new AppError("GOOGLE_REAUTH_REQUIRED", 401);
      }
      throw new AppError("GOOGLE_REFRESH_UNAVAILABLE", 503, true);
    }
  }
  async request(
    base: string,
    params: Record<string, string>,
    bearer?: string,
    method?: string,
    httpMethod = "GET",
    body?: Record<string, Json>,
  ): Promise<Page> {
    const url = new URL(base);
    if (
      ![
        "www.googleapis.com",
        "youtubeanalytics.googleapis.com",
        "youtubereporting.googleapis.com",
      ].includes(url.hostname) ||
      url.protocol !== "https:"
    )
      throw new AppError("PROVIDER_URL_NOT_ALLOWED", 403);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    else if (this.config.YOUTUBE_DATA_API_KEY)
      headers["X-Goog-Api-Key"] = this.config.YOUTUBE_DATA_API_KEY;
    else throw new AppError("PUBLIC_API_KEY_NOT_CONFIGURED", 503);
    if (body) headers["Content-Type"] = "application/json";
    for (let attempt = 0; attempt < 3; attempt++) {
      if (method) {
        const rule = quotaRule(method, this.config);
        await this.store.reserveQuota(
          this.config.GOOGLE_PROJECT_NUMBER,
          quotaDay(),
          rule.bucket,
          method,
          rule.limit,
        );
      }
      let response: Response;
      try {
        response = await this.io.fetch(url, {
          method: httpMethod,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(20_000),
          redirect: "error",
        });
      } catch {
        if (httpMethod === "GET" && attempt < 2) {
          await this.io.sleep(retryDelay(attempt, null));
          continue;
        }
        throw new AppError("GOOGLE_NETWORK_UNAVAILABLE", 503, true);
      }
      const data = (await response.json().catch(() => ({}))) as Page & {
        error?: { errors?: { reason: string }[]; status?: string };
      };
      if (response.ok) return data;
      const reason = data.error?.errors?.[0]?.reason;
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded")
        throw new AppError("GOOGLE_QUOTA_EXHAUSTED", 429, false);
      if (response.status === 401)
        throw new AppError("GOOGLE_REAUTH_REQUIRED", 401);
      if (response.status === 403)
        throw new AppError(
          reason === "accessNotConfigured"
            ? "GOOGLE_SERVICE_DISABLED"
            : "GOOGLE_FORBIDDEN",
          403,
        );
      if (
        (response.status === 429 || response.status >= 500) &&
        httpMethod === "GET" &&
        attempt < 2
      ) {
        const delay = retryDelay(attempt, response.headers.get("Retry-After"));
        if (delay > 60_000) throw new AppError("GOOGLE_RETRY_LATER", 503, true);
        await this.io.sleep(delay);
        continue;
      }
      throw new AppError(
        response.status === 400
          ? "GOOGLE_QUERY_UNSUPPORTED"
          : "GOOGLE_REQUEST_FAILED",
        502,
        response.status >= 500 || response.status === 429,
      );
    }
    throw new AppError("GOOGLE_REQUEST_FAILED", 502);
  }
  data(path: string, params: Record<string, string>, method: string) {
    return this.request(
      `https://www.googleapis.com/youtube/v3/${path}`,
      params,
      undefined,
      method,
    );
  }
  async lookupVideo(owner: string, id: string) {
    const result = await this.data(
        "videos",
        { id, part: "snippet,contentDetails,statistics" },
        "videos.list",
      ),
      video = result.items?.find((v) => v.id === id);
    if (!video) throw new AppError("VIDEO_NOT_FOUND_OR_PRIVATE", 404);
    const snippet = obj(video.snippet),
      details = obj(video.contentDetails),
      meta = envelope(null, "youtube_data_api", {
        coverage: "Single visible public video; no earlier history",
      }).meta;
    const batch = await this.batchStats([id]),
      stats = obj(
        batch.items.find((v) => v.id === id)?.statistics ?? video.statistics,
      );
    return this.store.putEntity(
      owner,
      "video",
      id,
      {
        channel_id: snippet.channelId ?? null,
        title: snippet.title ?? null,
        description:
          typeof snippet.description === "string"
            ? snippet.description.slice(0, 2000)
            : null,
        duration: details.duration ?? null,
        published_at: snippet.publishedAt ?? null,
        format: "unknown",
        format_confidence: "not_authoritatively_exposed",
        statistics: stats,
      },
      meta,
      publicExpiry(),
    );
  }
  async syncChannel(owner: string, input: string) {
    const now = new Date(),
      expires = publicExpiry(now);
    const response = await this.data(
      "channels",
      {
        part: "snippet,contentDetails,statistics",
        ...(input.startsWith("@") ? { forHandle: input } : { id: input }),
      },
      "channels.list",
    );
    const channel = response.items?.[0];
    if (!channel || typeof channel.id !== "string")
      throw new AppError("CHANNEL_NOT_FOUND_OR_PRIVATE", 404);
    const id = channel.id,
      snippet = obj(channel.snippet),
      stats = obj(channel.statistics),
      playlist = obj(obj(channel.contentDetails).relatedPlaylists).uploads;
    if (typeof playlist !== "string")
      throw new AppError("UPLOADS_PLAYLIST_UNAVAILABLE", 404);
    const previous = await this.store.entity(owner, "channel", id);
    const meta = envelope(null, "youtube_data_api", {
      coverage: "public channel and uploads; not all YouTube",
    }).meta;
    await this.store.putEntity(
      owner,
      "channel",
      id,
      {
        title: snippet.title ?? null,
        handle: snippet.customUrl ?? null,
        thumbnail: obj(obj(snippet.thumbnails).default).url ?? null,
        uploads_playlist_id: playlist,
        tracking_since: previous?.body.tracking_since ?? now.toISOString(),
        statistics: stats,
      },
      meta,
      expires,
    );
    await this.store.observe(
      owner,
      id,
      "public_channel",
      stats,
      meta,
      now,
      `${id}:${now.toISOString()}`,
      expires,
    );
    let pageToken = "",
      count = 0,
      pages = 0;
    const seenVideos = new Set<string>(),
      seenPages = new Set<string>();
    do {
      if (seenPages.has(pageToken))
        throw new AppError("PLAYLIST_CURSOR_REPEATED", 502);
      seenPages.add(pageToken);
      pages++;
      const page = await this.data(
        "playlistItems",
        {
          part: "contentDetails",
          playlistId: playlist,
          maxResults: "50",
          ...(pageToken ? { pageToken } : {}),
        },
        "playlistItems.list",
      );
      const ids = [
        ...new Set(
          (page.items ?? [])
            .map((item) => obj(item.contentDetails).videoId)
            .filter(
              (x): x is string => typeof x === "string" && !seenVideos.has(x),
            ),
        ),
      ];
      ids.forEach((id) => seenVideos.add(id));
      if (ids.length) {
        const videos = await this.data(
          "videos",
          { part: "snippet,contentDetails,statistics", id: ids.join(",") },
          "videos.list",
        );
        for (const video of videos.items ?? []) {
          if (typeof video.id !== "string") continue;
          const s = obj(video.snippet),
            c = obj(video.contentDetails),
            v = obj(video.statistics);
          await this.store.putEntity(
            owner,
            "video",
            video.id,
            {
              channel_id: id,
              title: s.title ?? null,
              description:
                typeof s.description === "string"
                  ? s.description.slice(0, 2000)
                  : null,
              published_at: s.publishedAt ?? null,
              thumbnail: obj(obj(s.thumbnails).medium).url ?? null,
              duration: c.duration ?? null,
              format: "unknown",
              format_confidence: "not_authoritatively_exposed",
              statistics: v,
            },
            meta,
            expires,
          );
          await this.store.observe(
            owner,
            video.id,
            "public_video",
            v,
            meta,
            now,
            `${video.id}:${now.toISOString()}`,
            expires,
          );
          count++;
        }
      }
      pageToken = page.nextPageToken ?? "";
    } while (pageToken && pages < 4 && count < 200);
    return {
      channel_id: id,
      videos: count,
      coverage: pageToken
        ? "first four upload pages (at most 200 records); more available"
        : "all currently visible playlist pages",
    };
  }
  async batchStats(ids: string[]) {
    const collected: Record<string, Json>[] = [],
      failed: string[] = [];
    for (let offset = 0; offset < ids.length; offset += 50) {
      const batch = ids.slice(offset, offset + 50);
      let result: Page;
      try {
        result = await this.data(
          "videos:batchGetStats",
          { id: batch.join(","), part: "statistics" },
          "videos.batchGetStats",
        );
      } catch (error) {
        if (
          !(error instanceof AppError) ||
          !["GOOGLE_QUERY_UNSUPPORTED", "GOOGLE_REQUEST_FAILED"].includes(
            error.code,
          )
        )
          throw error;
        result = await this.data(
          "videos",
          { id: batch.join(","), part: "statistics" },
          "videos.list",
        );
      }
      collected.push(...(result.items ?? []));
      const missing = batch.filter(
        (id) => !(result.items ?? []).some((v) => v.id === id),
      );
      if (missing.length && result.summary?.failedVideoIds?.length) {
        const retry = await this.data(
          "videos",
          { id: missing.join(","), part: "statistics" },
          "videos.list",
        );
        collected.push(...(retry.items ?? []));
        failed.push(
          ...missing.filter(
            (id) => !(retry.items ?? []).some((v) => v.id === id),
          ),
        );
      } else failed.push(...missing);
    }
    return { items: collected, failed_video_ids: [...new Set(failed)] };
  }
  async analytics(
    owner: string,
    kind: string,
    from: string,
    to: string,
    video?: string,
  ) {
    const token = await this.bearer(owner);
    const params: Record<string, string> = {
      ids: "channel==MINE",
      startDate: from,
      endDate: to,
    };
    if (kind === "retention") {
      if (!video) throw new AppError("VIDEO_REQUIRED");
      params.metrics = "audienceWatchRatio,relativeRetentionPerformance";
      params.dimensions = "elapsedVideoTimeRatio";
      params.filters = `video==${video}`;
    } else if (kind === "traffic") {
      params.metrics = "views,estimatedMinutesWatched";
      params.dimensions = "insightTrafficSourceType";
      if (video) params.filters = `video==${video}`;
    } else {
      params.metrics =
        "views,engagedViews,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost";
      params.dimensions = "day";
      params.sort = "day";
      if (video) params.filters = `video==${video}`;
    }
    let result: Page;
    try {
      result = await this.request(
        "https://youtubeanalytics.googleapis.com/v2/reports",
        params,
        token,
      );
    } catch (error) {
      if (
        error instanceof AppError &&
        ["GOOGLE_REAUTH_REQUIRED", "GOOGLE_FORBIDDEN"].includes(error.code)
      )
        await this.store.disconnect(owner);
      throw error;
    }
    const columns = (result.columnHeaders ?? []).map((x) => x.name),
      rows = (result.rows ?? []).map(
        (row) =>
          Object.fromEntries(
            columns.map((name, i) => [name, row[i] ?? null]),
          ) as Record<string, Json>,
      );
    const meta = envelope(null, "youtube_analytics_api", {
      coverage: `${from} through ${to}; provider may lag or suppress data`,
      not_available: rows.length ? null : "not_yet_reported",
      limitations: ["Views and engaged views are different measures."],
    }).meta;
    await this.store.observe(
      owner,
      video ?? this.config.OWNED_CHANNEL_ID,
      `owned_${kind}`,
      { from, to, columns, rows },
      meta,
      new Date(),
      `${video ?? "channel"}:${kind}:${from}:${to}`,
    );
    return envelope({ from, to, columns, rows }, "youtube_analytics_api", meta);
  }
  async syncOwned(owner: string) {
    const now = DateTime.utc(),
      from = now.minus({ days: 28 }).toISODate()!,
      to = now.minus({ days: 2 }).toISODate()!;
    await this.analytics(owner, "overview", from, to);
    await this.analytics(owner, "traffic", from, to);
    return { from, to };
  }
  async reporting(owner: string, createMissing = false) {
    const token = await this.bearer(owner),
      base = "https://youtubereporting.googleapis.com/v1";
    const types = await this.request(`${base}/reportTypes`, {}, token);
    let jobs = (await this.request(`${base}/jobs`, {}, token)).jobs ?? [];
    const available = new Set((types.reportTypes ?? []).map((x) => x.id));
    for (const type of [
      "channel_reach_basic_a1",
      "channel_reach_combined_a1",
    ]) {
      if (!available.has(type)) continue;
      if (createMissing && !jobs.some((j) => j.reportTypeId === type)) {
        await this.request(`${base}/jobs`, {}, token, undefined, "POST", {
          reportTypeId: type,
          name: `Creator Intelligence - ${type}`,
        });
        jobs = (await this.request(`${base}/jobs`, {}, token)).jobs ?? [];
      }
    }
    let ingested = 0;
    for (const job of jobs.filter((j) =>
      j.reportTypeId.startsWith("channel_reach_"),
    )) {
      await this.store.putEntity(
        owner,
        "report_job",
        job.id,
        { report_type: job.reportTypeId },
        envelope(null, "youtube_reporting_api").meta,
      );
      let pageToken = "";
      do {
        const page = await this.request(
          `${base}/jobs/${encodeURIComponent(job.id)}/reports`,
          { ...(pageToken ? { pageToken } : {}), pageSize: "50" },
          token,
        );
        for (const report of page.reports ?? []) {
          if (await this.store.entity(owner, "report", report.id)) continue;
          const u = new URL(report.downloadUrl);
          if (
            u.protocol !== "https:" ||
            !["youtubereporting.googleapis.com", "www.googleapis.com"].includes(
              u.hostname,
            )
          )
            throw new AppError("REPORT_DOWNLOAD_HOST_REJECTED", 403);
          const response = await this.io.fetch(u, {
            headers: { Authorization: `Bearer ${token}` },
            redirect: "error",
            signal: AbortSignal.timeout(30_000),
          });
          if (!response.ok)
            throw new AppError("REPORT_DOWNLOAD_FAILED", 502, true);
          if (Number(response.headers.get("content-length") ?? 0) > 25_000_000)
            throw new AppError("REPORT_TOO_LARGE", 413);
          const text = await response.text();
          if (text.length > 25_000_000)
            throw new AppError("REPORT_TOO_LARGE", 413);
          const rows = parseReport(text);
          for (const row of rows) {
            if (row.channel_id !== this.config.OWNED_CHANNEL_ID)
              throw new AppError("REPORT_OWNER_MISMATCH", 403);
            const impressions =
                row.video_thumbnail_impressions === ""
                  ? null
                  : Number(row.video_thumbnail_impressions),
              ctr =
                row.video_thumbnail_impressions_ctr === ""
                  ? null
                  : Number(row.video_thumbnail_impressions_ctr);
            if (
              (impressions !== null && !Number.isFinite(impressions)) ||
              (ctr !== null && (!Number.isFinite(ctr) || ctr < 0 || ctr > 1))
            )
              throw new AppError("REPORT_SCHEMA_UNSUPPORTED", 422);
            // Combined reports contain dimensional slices; store separately so
            // no UI sums CTRs or doubles the basic report.
            const meta: Meta = envelope(null, "youtube_reporting_api", {
              coverage: job.reportTypeId,
            }).meta;
            const dimensions = Object.fromEntries(
              Object.entries(row)
                .filter(
                  ([key]) =>
                    ![
                      "video_thumbnail_impressions",
                      "video_thumbnail_impressions_ctr",
                    ].includes(key),
                )
                .sort(([a], [b]) => a.localeCompare(b)),
            );
            await this.store.observe(
              owner,
              row.video_id!,
              job.reportTypeId === "channel_reach_basic_a1"
                ? "owned_reach"
                : "owned_reach_combined",
              {
                date: row.date!,
                impressions,
                ctr,
                report_type: job.reportTypeId,
                dimensions,
              },
              meta,
              new Date(report.createTime),
              `${job.reportTypeId}:${digest(JSON.stringify(dimensions))}`,
            );
          }
          await this.store.putEntity(
            owner,
            "report",
            report.id,
            { report_type: job.reportTypeId, rows: rows.length },
            envelope(null, "youtube_reporting_api").meta,
          );
          ingested++;
        }
        pageToken = page.nextPageToken ?? "";
      } while (pageToken);
    }
    return {
      jobs: jobs
        .filter((j) => j.reportTypeId.startsWith("channel_reach_"))
        .map((j) => ({ id: j.id, type: j.reportTypeId })),
      ingested,
      status: ingested ? "ingested" : "pending_or_already_ingested",
    };
  }
  async disconnect(owner: string) {
    // Google revocation invalidates ALL clients in this shared project, including
    // the established publisher. Local disconnect intentionally never calls it.
    await this.store.disconnect(owner);
  }
  async revokeProject(owner: string) {
    const connection = await this.store.connection(owner);
    if (!connection) throw new AppError("GOOGLE_NOT_CONNECTED", 409);
    const tokens = unseal<Credentials>(
      connection.encrypted,
      this.config.APP_ENCRYPTION_KEY,
      owner,
    );
    const token = tokens.refresh_token ?? tokens.access_token;
    if (!token) throw new AppError("GOOGLE_REAUTH_REQUIRED", 401);
    let response: Response;
    try {
      response = await this.io.fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new AppError("GOOGLE_PROJECT_REVOCATION_UNCONFIRMED", 502);
    }
    if (!response.ok)
      throw new AppError("GOOGLE_PROJECT_REVOCATION_UNCONFIRMED", 502);
    await this.store.disconnect(owner);
  }
}
