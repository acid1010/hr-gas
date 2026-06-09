FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# API URL injected at build time so NEXT_PUBLIC_* gets baked into the bundle
ARG NEXT_PUBLIC_API_BASE_URL_PRODUCTION
ENV NEXT_PUBLIC_API_BASE_URL_PRODUCTION=$NEXT_PUBLIC_API_BASE_URL_PRODUCTION
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./app/.next/static
COPY --from=builder /app/public ./app/public
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "app/server.js"]
