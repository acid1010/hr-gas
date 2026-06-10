FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY patches ./patches
RUN npm ci
COPY . .
RUN DATABASE_URL=postgresql://x:x@localhost:5432/x npx prisma generate
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src ./src
COPY --from=deps /app/libs ./libs
COPY --from=deps /app/prisma ./prisma
COPY --from=deps /app/package*.json ./
EXPOSE 3041
CMD ["node", "src/index.js"]
