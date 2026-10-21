# syntax=docker/dockerfile:1.7
# Core API and worker share this image; the worker runs with CMD ["node", "dist/worker.js"].
# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:24.22-bookworm-slim@sha256:91acba91b842bec0bf7ea6f5e09c644c7ccad72c4996ed9616d861d1c7cd60d4 AS base
# Corepack cannot run pnpm 12 yet, so the pinned version is installed directly.
RUN npm install --global --no-fund --no-audit pnpm@12.14.0
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @kawan-pasar/api... --ignore-scripts
RUN pnpm --filter @kawan-pasar/api... run build
RUN pnpm --filter @kawan-pasar/api deploy --prod --legacy /out

FROM node:24.22-bookworm-slim@sha256:91acba91b842bec0bf7ea6f5e09c644c7ccad72c4996ed9616d861d1c7cd60d4
ENV NODE_ENV=production
# npm, Corepack, and Yarn are build tools; dropping them removes their bundled dependencies.
RUN rm -rf /usr/local/lib/node_modules /opt/yarn-*     /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --retries=3 --start-period=10s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4000/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
