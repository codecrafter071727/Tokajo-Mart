# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f services/delivery/Dockerfile .
ARG NODE_VERSION=22.23.4

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH HUSKY=0 CI=true
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@^2 prune @qc/delivery --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@qc/delivery
RUN pnpm --filter=@qc/delivery deploy --prod --legacy /out

FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production PORT=8080
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /out .
USER app
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/server.js"]
