# syntax=docker/dockerfile:1.7
# Web (UI + BFF) as a Next.js standalone server (docs 12 §11). Build from the repo root:
# docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_APP_URL=... .
FROM node:24.11-bookworm-slim@sha256:48abc13a19400ca3985071e287bd405a1d99306770eb81d61202fb6b65cf0b57 AS build
# Corepack in Node 24.11 cannot run pnpm 12, so the pinned version is installed directly.
RUN npm install --global --no-fund --no-audit pnpm@12.14.0
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/root/.cache/pnpm \
    pnpm install --frozen-lockfile --store-dir /root/.cache/pnpm --filter @kawan-pasar/web... --ignore-scripts
# NEXT_PUBLIC_* values are inlined at build time, so they are build arguments, never secrets.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_DATA_MODE=demo
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL NEXT_PUBLIC_DATA_MODE=$NEXT_PUBLIC_DATA_MODE NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @kawan-pasar/web... run build

FROM node:24.11-bookworm-slim@sha256:48abc13a19400ca3985071e287bd405a1d99306770eb81d61202fb6b65cf0b57
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=root:root /repo/apps/web/.next/standalone ./
COPY --from=build --chown=root:root /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=3 --start-period=20s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
