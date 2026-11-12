# syntax=docker/dockerfile:1
# Build context: repository root (docker build -f apps/web/Dockerfile .)
# The build never needs the API: data pages are rendered on first request (ADR 0009).

FROM node:24-alpine AS build
RUN npm install -g pnpm@11.15.1
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN --mount=type=cache,id=kp-pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store --network-concurrency 4 \
      --fetch-retries 6 --fetch-timeout 120000 --filter "@kawan-pasar/web..."
RUN pnpm --filter "@kawan-pasar/web^..." run --if-present build \
 && pnpm --filter @kawan-pasar/web build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
# Standalone server (traced node_modules) + static assets. Owned by root, run as `node`, so the
# application cannot modify its own code; only .next/cache (tmpfs in compose) is writable.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
RUN mkdir -p /app/apps/web/.next/cache && chown node:node /app/apps/web/.next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
