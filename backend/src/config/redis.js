const { createClient } = require("redis");

const redis = createClient({
  url: process.env.REDIS_URL || "redis://:Idnas77%23@127.0.0.1:6379",
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        return new Error("Unable to connect to Redis after 5 attempts");
      }
      return Math.min(retries * 100, 3000); // Exponential backoff
    },
  },
});

redis.on("connect", () => {
  console.log("Connected to Redis successfully");
});

redis.on("error", (err) => {
  console.error("Redis Client Error", err);
});

module.exports = redis;
