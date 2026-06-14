# syntax=docker/dockerfile:1.7

# ---------- 1. deps: install ALL deps (dev needed for `next build`) ----------
FROM node:20-alpine AS deps
WORKDIR /workspace/frontend
RUN apk add --no-cache libc6-compat
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ---------- 2. build: produce Next.js standalone output ----------
FROM node:20-alpine AS build
# WORKDIR is intentionally /workspace/frontend so that next.config.mjs's
# outputFileTracingRoot=../ produces .next/standalone/frontend/server.js
# (the basename of the cwd determines the standalone subdir name).
WORKDIR /workspace/frontend
RUN apk add --no-cache libc6-compat
COPY --from=deps /workspace/frontend/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* must be present at build time so Next inlines it into the client bundle.
ARG NEXT_PUBLIC_API_BASE_URL_PRODUCTION
ENV NEXT_PUBLIC_API_BASE_URL_PRODUCTION=$NEXT_PUBLIC_API_BASE_URL_PRODUCTION
ENV NEXT_TELEMETRY_DISABLED=1

# Run only `next build` — the package.json build script's `cp` postcopy
# uses paths that only work on the host. We do the copy explicitly below.
RUN npx next build \
 && cp -r .next/static .next/standalone/frontend/.next/static \
 && cp -r public        .next/standalone/frontend/public

# ---------- 3. runner: tiny, non-root, signal-safe ----------
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache dumb-init wget tzdata \
 && cp /usr/share/zoneinfo/Asia/Jakarta /etc/localtime \
 && echo "Asia/Jakarta" > /etc/timezone

ENV NODE_ENV=production \
    TZ=Asia/Jakarta \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Lift the entire standalone tree. Entrypoint is frontend/server.js because
# next.config.mjs's outputFileTracingRoot=../ nests output under frontend/.
COPY --chown=node:node --from=build /workspace/frontend/.next/standalone ./

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "frontend/server.js"]
