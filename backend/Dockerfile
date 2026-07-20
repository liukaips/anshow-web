# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_DIR=/pnpm/store
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable \
    && corepack prepare pnpm@10.11.0 --activate \
    && pnpm config set store-dir /pnpm/store
WORKDIR /app

FROM base AS build
RUN --mount=type=cache,id=apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=apt-lists,target=/var/lib/apt/lists,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends g++ make python3 \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --prefer-offline --filter @anshow/backend...
COPY backend backend
COPY content/assets/manifest.json content/assets/manifest.json
RUN pnpm --filter @anshow/backend build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm --filter @anshow/backend deploy --legacy --prod /prod/backend

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN mkdir -p /app/backend/dist/db /app/backend/dist/scripts /app/backend/dist/worker /data /media \
    && chown -R node:node /app /data /media
COPY --from=build --chown=node:node /prod/backend/node_modules ./backend/node_modules
COPY --from=build --chown=node:node /prod/backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /app/backend/dist/server.js ./backend/dist/server.js
COPY --from=build --chown=node:node /app/backend/dist/db/migrate.js ./backend/dist/db/migrate.js
COPY --from=build --chown=node:node /app/backend/dist/scripts/create-admin.js ./backend/dist/scripts/create-admin.js
COPY --from=build --chown=node:node /app/backend/dist/worker/index.js ./backend/dist/worker/index.js
COPY --from=build --chown=node:node /app/backend/migrations ./backend/migrations
COPY --from=build --chown=node:node /app/content/assets/manifest.json ./content/assets/manifest.json
USER node
CMD ["node", "backend/dist/server.js"]
