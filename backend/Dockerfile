FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hr?sslmode=disable" npx prisma generate
RUN npm prune --omit=dev
EXPOSE 3041
CMD ["node", "src/index.js"]
