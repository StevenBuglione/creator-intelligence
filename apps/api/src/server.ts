import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import { z, ZodError } from "zod";
import { AppError, envelope } from "../../../packages/domain/src/index.js";
import {
  digest,
  equal,
  hashPassword,
  randomToken,
  verifyPassword,
} from "../../../packages/security/src/index.js";
import type { Config } from "../../../packages/config/src/index.js";
import { Store } from "../../../packages/db/src/index.js";
import {
  Application,
  type Actor,
} from "../../../packages/intelligence/src/index.js";

export async function createServer(
  config: Config,
  store = new Store(config.DATABASE_URL),
  application = new Application(store, config),
) {
  await store.migrate();
  if (config.OWNER_PASSWORD)
    await store.initializeOwner(
      config.OWNER_ID,
      hashPassword(config.OWNER_PASSWORD),
    );
  const app = Fastify({
    logger: false,
    bodyLimit: 150000,
    requestTimeout: 30000,
  });
  await app.register(cookie);
  await app.register(cors, {
    origin: config.APP_ORIGIN,
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "Authorization"],
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(swagger, {
    openapi: { info: { title: "Creator Intelligence", version: "0.1.0" } },
  });
  const actors = new WeakMap<object, Actor>();
  const secure = new URL(config.API_ORIGIN).protocol === "https:";
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 8 * 3600,
  };
  app.setErrorHandler((error, _request, reply) => {
    const status =
      error instanceof AppError
        ? error.status
        : error instanceof ZodError
          ? 400
          : error &&
              typeof error === "object" &&
              "statusCode" in error &&
              typeof error.statusCode === "number"
            ? error.statusCode
            : 500;
    const code =
      error instanceof AppError
        ? error.code
        : error instanceof ZodError
          ? "INVALID_INPUT"
          : status === 429
            ? "RATE_LIMITED"
            : "INTERNAL_ERROR";
    reply.code(status).send({
      error: {
        code,
        retryable: error instanceof AppError ? error.retryable : false,
      },
    });
  });
  app.addHook("onRequest", async (request, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer");
    const host = request.headers.host?.split(":")[0];
    if (
      !host ||
      ![
        "localhost",
        "127.0.0.1",
        "api",
        new URL(config.API_ORIGIN).hostname,
      ].includes(host)
    )
      throw new AppError("HOST_REJECTED", 403);
    if (request.method === "OPTIONS") return;
    const path = request.url.split("?")[0];
    if (path === "/healthz") return;
    if (request.headers.origin && request.headers.origin !== config.APP_ORIGIN)
      throw new AppError("ORIGIN_REJECTED", 403);
    if (path === "/api/v1/login") {
      if (request.headers.origin !== config.APP_ORIGIN)
        throw new AppError("ORIGIN_REQUIRED", 403);
      return;
    }
    const bearer = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (bearer) {
      if (request.headers.origin)
        throw new AppError("SERVICE_TOKEN_BROWSER_FORBIDDEN", 403);
      const role = equal(bearer, config.MCP_TOKEN)
        ? "agent"
        : equal(bearer, config.WORKER_TOKEN)
          ? "worker"
          : null;
      if (!role) throw new AppError("UNAUTHORIZED", 401);
      actors.set(request, { owner: config.OWNER_ID, role });
      return;
    }
    const hash = digest(request.cookies.ci_session ?? ""),
      session = await store.session(hash);
    if (!session) throw new AppError("LOGIN_REQUIRED", 401);
    if (
      !["GET", "HEAD"].includes(request.method) &&
      (request.headers.origin !== config.APP_ORIGIN ||
        typeof request.headers["x-csrf-token"] !== "string" ||
        !equal(request.headers["x-csrf-token"], session.csrf))
    )
      throw new AppError("CSRF_REJECTED", 403);
    actors.set(request, {
      owner: session.owner_id,
      role: "owner",
      sessionHash: hash,
    });
  });
  app.get("/healthz", async () => {
    await store.pool.query("SELECT 1");
    return { status: "ok", service: "creator-intelligence-api" };
  });
  app.post(
    "/api/v1/login",
    { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { password } = z
          .object({ password: z.string().max(200) })
          .strict()
          .parse(request.body),
        stored = await store.passwordHash(config.OWNER_ID);
      if (!stored || !(await verifyPassword(password, stored)))
        throw new AppError("LOGIN_FAILED", 401);
      const token = randomToken(),
        csrf = randomToken();
      await store.putSession(
        digest(token),
        config.OWNER_ID,
        csrf,
        new Date(Date.now() + 8 * 3600_000),
      );
      reply.setCookie("ci_session", token, cookieOptions);
      return envelope({ csrf }, "system");
    },
  );
  app.get("/api/v1/session", async (request) => {
    const actor = actors.get(request)!;
    if (!actor.sessionHash) throw new AppError("OWNER_SESSION_REQUIRED", 403);
    return envelope(
      { csrf: (await store.session(actor.sessionHash))!.csrf },
      "system",
    );
  });
  app.post("/api/v1/logout", async (request, reply) => {
    const actor = actors.get(request)!;
    if (!actor.sessionHash) throw new AppError("OWNER_SESSION_REQUIRED", 403);
    await store.endSession(actor.sessionHash);
    reply.clearCookie("ci_session", cookieOptions);
    return { ok: true };
  });
  app.post("/api/v1/auth/google/start", async (request) => {
    const a = actors.get(request)!;
    if (a.role !== "owner" || !a.sessionHash)
      throw new AppError("OWNER_SESSION_REQUIRED", 403);
    return envelope(
      { url: await application.youtube.startOAuth(a.owner, a.sessionHash) },
      "system",
    );
  });
  app.get("/api/v1/auth/google/callback", async (request, reply) => {
    const actor = actors.get(request)!;
    if (!actor.sessionHash) throw new AppError("OWNER_SESSION_REQUIRED", 403);
    const { state, code } = z
      .object({
        state: z.string().min(32).max(200),
        code: z.string().max(4000),
      })
      .parse(request.query);
    await application.youtube.finishOAuth(state, code, actor.sessionHash);
    return reply.redirect(config.APP_ORIGIN + "/?connected=1");
  });
  app.post<{ Params: { operation: string } }>(
    "/api/v1/operations/:operation",
    {
      schema: {
        params: {
          type: "object",
          properties: { operation: { type: "string" } },
          required: ["operation"],
        },
        body: { type: "object", additionalProperties: true },
      },
    },
    (request) =>
      application.call(
        actors.get(request)!,
        request.params.operation,
        request.body,
      ),
  );
  app.get("/api/v1/openapi", async (request) => {
    if (actors.get(request)!.role !== "owner")
      throw new AppError("OWNER_SESSION_REQUIRED", 403);
    return app.swagger();
  });
  for (const path of ["/research/outliers", "/api/v1/research/outliers"])
    app.get(path, (request) =>
      application.call(actors.get(request)!, "outliers", {}),
    );
  app.addHook("onClose", async () => store.close());
  return app;
}
