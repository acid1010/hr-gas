FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN DATABASE_URL=postgresql://x:x@localhost:5432/x npx prisma generate
EXPOSE 3041
CMD ["node", "src/index.js"]
