# syntax=docker/dockerfile:1
# Build context: repository root (docker build -f apps/api/Dockerfile .)

FROM node:24-alpine AS build
RUN npm install -g pnpm@11.15.1
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages ./packages
COPY apps/api ./apps/api
# The BuildKit cache keeps the pnpm store between builds; retries absorb flaky registry access.
RUN --mount=type=cache,id=kp-pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store --network-concurrency 4 \
      --fetch-retries 6 --fetch-timeout 120000 --filter "@kawan-pasar/api..."
RUN --mount=type=cache,id=kp-pnpm-store,target=/pnpm-store \
    pnpm --filter "@kawan-pasar/api^..." run --if-present build \
 && pnpm --filter @kawan-pasar/api build \
 && pnpm --filter @kawan-pasar/api deploy --prod --legacy --store-dir /pnpm-store /out

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
