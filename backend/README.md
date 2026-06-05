# Backend HR API

Express.js backend for the HR application. The API uses Prisma with PostgreSQL and Redis.

## Runtime

- Node.js: tested with `v24.15.0`
- npm: tested with `11.12.1`
- PM2: tested with `7.0.1`
- Database: PostgreSQL, configured through `DATABASE_URL` in `.env`
- Cache/session dependency: Redis on `127.0.0.1:6379`

## Project Structure

```text
src/index.js              Express app entrypoint
src/routes/auth.js        Authentication routes
src/routes/members.js     Member routes
src/routes/performance.js Performance routes
src/config/redis.js       Redis client configuration
libs/prisma.js            Prisma client setup
prisma/schema.prisma      Prisma schema
.env                      Local environment variables
```

## Environment

Required environment variables:

```env
DATABASE_URL="postgresql://postgres:12345@localhost:5432/hr?sslmode=disable"
PORT=3041
JWT_SECRET="your-access-token-secret"
JWT_REFRESH="your-refresh-token-secret"
REDIS_URL="redis://:Idnas77%23@127.0.0.1:6379"
```

Notes:

- `PORT` is not currently defined in `.env`, so it must be supplied when starting the app.
- `REDIS_URL` is optional because `src/config/redis.js` has a default local Redis URL.
- PostgreSQL must already be running and the `hr` database must exist.

## Install Dependencies

```powershell
npm install
```

## Start Redis With Docker

If Redis is not installed locally, run it with Docker:

```powershell
docker run -d --name "backend-hr-redis" -p 6379:6379 redis:7-alpine redis-server --requirepass "Idnas77#"
```

Check Redis container status:

```powershell
docker ps --filter "name=backend-hr-redis"
```

If the container already exists but is stopped:

```powershell
docker start backend-hr-redis
```

## Run With PM2

Start the API on port `3041`:

```powershell
$env:PORT='3041'; pm2 start "src/index.js" --name "backend-hr" --update-env
```

Restart after changing environment variables:

```powershell
$env:PORT='3041'; pm2 restart "backend-hr" --update-env
```

Save the PM2 process list:

```powershell
pm2 save
```

Check status:

```powershell
pm2 status
pm2 describe "backend-hr"
```

View logs:

```powershell
pm2 logs "backend-hr"
```

## Verify The API

After Redis and PM2 are running, verify the app:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:3041/members?limit=1" -UseBasicParsing
```

Expected result: HTTP `200`.

## Available Routes

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh_token`
- `GET /members`
- `POST /members`
- `GET /api/performance`
- `POST /api/performance/post`
- `DELETE /api/performance/delete/:id`

## Troubleshooting

### Redis Connection Refused

Error example:

```text
Redis Client Error Error: connect ECONNREFUSED 127.0.0.1:6379
Fatal error during server startup: ReconnectStrategyError
```

Fix:

```powershell
docker start backend-hr-redis
$env:PORT='3041'; pm2 restart "backend-hr" --update-env
```

### Port Is Undefined

If logs show `Server is running on port undefined`, restart PM2 with `PORT` set:

```powershell
$env:PORT='3041'; pm2 restart "backend-hr" --update-env
```

### Check PM2 Logs

```powershell
pm2 logs "backend-hr" --lines 100
```

### Check Docker Redis Logs

```powershell
docker logs backend-hr-redis
```

## Current Working Setup

The app was successfully started with:

```powershell
docker run -d --name "backend-hr-redis" -p 6379:6379 redis:7-alpine redis-server --requirepass "Idnas77#"
$env:PORT='3041'; pm2 start "src/index.js" --name "backend-hr" --update-env
pm2 save
```

Verified with:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:3041/members?limit=1" -UseBasicParsing
```
