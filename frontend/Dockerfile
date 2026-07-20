# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_DIR=/pnpm/store
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable \
    && corepack prepare pnpm@10.11.0 --activate \
    && pnpm config set store-dir /pnpm/store
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --prefer-offline --filter @anshow/frontend...

FROM dependencies AS build
COPY frontend frontend
RUN pnpm --filter @anshow/frontend build

FROM node:24-bookworm-slim AS runtime
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/public ./frontend/public
COPY --from=build --chown=node:node /app/frontend/.next/static ./frontend/.next/static
USER node
WORKDIR /app/frontend
CMD ["node", "server.js"]
