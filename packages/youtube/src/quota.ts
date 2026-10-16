import { DateTime } from "luxon";
import type { Config } from "../../config/src/index.js";
export const quotaDay = (at = new Date()) =>
  DateTime.fromJSDate(at, { zone: "America/Los_Angeles" }).toISODate()!;
export const quotaReset = (at = new Date()) =>
  DateTime.fromJSDate(at, { zone: "America/Los_Angeles" })
    .plus({ days: 1 })
    .startOf("day")
    .toUTC()
    .toISO()!;
export function quotaRule(method: string, c: Config) {
  if (method === "search.list")
    return { bucket: "search", limit: c.SEARCH_DAILY_BUDGET };
  if (method === "videos.batchGetStats")
    return { bucket: "batch_stats", limit: c.BATCH_DAILY_BUDGET };
  return { bucket: "general", limit: c.GENERAL_DAILY_BUDGET };
}
export const publicExpiry = (at = new Date()) =>
  DateTime.fromJSDate(at, { zone: "utc" }).plus({ days: 30 }).toJSDate();
export const approvedStatExpiry = (at: Date) =>
  DateTime.fromJSDate(at, { zone: "utc" }).plus({ months: 36 }).toJSDate();
export function retryDelay(
  attempt: number,
  retryAfter: string | null,
  now = Date.now(),
  random = Math.random,
) {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const ms = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(retryAfter) - now;
    if (Number.isFinite(ms) && ms >= 0) return ms;
  }
  return Math.min(30_000, 500 * 2 ** attempt + random() * 250);
}
