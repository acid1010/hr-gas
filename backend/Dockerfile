# syntax=docker/dockerfile:1.7

# ---------- 1. build: install all deps, generate prisma client ----------
# We need devDeps (prisma CLI) for `prisma generate`. The generated client
# lands in src/generated/prisma per schema.prisma's `output` directive.
FROM node:20-alpine AS build
WORKDIR /app

# Prisma + bcrypt + node-zklib need OpenSSL + build toolchain on alpine.
# libc6-compat keeps Prisma engines happy on musl.
RUN apk add --no-cache libc6-compat openssl

COPY package*.json ./
COPY patches ./patches
# npm ci runs `postinstall` → patch-package (needs ./patches present).
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src ./src
COPY libs ./libs
# Dummy URL — prisma generate doesn't connect, only reads schema.
# Output is src/generated/prisma/ (custom output dir per schema.prisma).
RUN DATABASE_URL=postgresql://x:x@localhost:5432/x npx prisma generate

# ---------- 2. prod-deps: fresh install of runtime deps only ----------
# Separate stage instead of `npm prune --omit=dev` because prune leaks
# prisma CLI + effect (~100MB transitive) on npm 10. Fresh install is
# deterministic via package-lock.json.
FROM node:20-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package*.json ./
COPY patches ./patches
# --ignore-scripts skips the postinstall (patch-package is a devDep, absent here).
# We then apply patches manually with a one-shot patch-package install.
# Also remove the `prisma` CLI peer dep + its transitive `effect` (~85MB) —
# npm 7+ auto-installs peer deps and there's no reliable flag to skip them.
# These are only needed for `prisma generate`/`migrate` which we already did
# in the build stage, never at runtime.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
 && npx --yes patch-package \
 && rm -rf node_modules/prisma node_modules/effect node_modules/fast-check \
           node_modules/jiti node_modules/@types

# ---------- 3. runner: minimal, non-root, signal-safe ----------
FROM node:20-alpine AS runner
WORKDIR /app

# dumb-init: PID 1 that forwards SIGTERM/SIGINT to node (clean shutdowns)
# openssl + libc6-compat: required by Prisma engine at runtime
# wget: used by HEALTHCHECK
RUN apk add --no-cache dumb-init openssl libc6-compat wget tzdata \
 && cp /usr/share/zoneinfo/Asia/Jakarta /etc/localtime \
 && echo "Asia/Jakarta" > /etc/timezone

ENV NODE_ENV=production \
    TZ=Asia/Jakarta \
    NPM_CONFIG_LOGLEVEL=warn

# node:alpine ships a non-root `node` user (uid 1000); reuse it.
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build     /app/src         ./src
COPY --chown=node:node --from=build     /app/libs        ./libs
COPY --chown=node:node --from=build     /app/prisma      ./prisma
COPY --chown=node:node --from=build     /app/package*.json ./

# Uploads dir owned by `node` so the process can write at runtime even
# without a volume mount (compose mounts a named volume on top in prod).
RUN mkdir -p /app/public/uploads && chown -R node:node /app/public

USER node

EXPOSE 3041

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3041/healthz || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
