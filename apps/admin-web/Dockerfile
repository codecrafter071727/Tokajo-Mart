# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f apps/admin-web/Dockerfile .
ARG NODE_VERSION=22.23.4

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH HUSKY=0 CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@^2 prune @qc/admin-web --docker

FROM base AS builder
ARG NEXT_PUBLIC_APP_ENV
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
COPY --from=pruner /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@qc/admin-web

FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /repo/apps/admin-web/.next/standalone ./
COPY --from=builder --chown=app:app /repo/apps/admin-web/.next/static ./apps/admin-web/.next/static
COPY --from=builder --chown=app:app /repo/apps/admin-web/public ./apps/admin-web/public
USER app
EXPOSE 8080
CMD ["node", "apps/admin-web/server.js"]
