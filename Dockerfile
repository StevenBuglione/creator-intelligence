FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS build
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages packages
COPY apps apps
COPY scripts/build.ts scripts/build.ts
COPY tsconfig.json tsconfig.build.json ./
RUN --mount=type=cache,id=ci-pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build
FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/backups && chown node:node /app/backups
USER node
CMD ["node","dist/apps/api/src/main.js"]
