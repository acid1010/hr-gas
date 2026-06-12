/** @type {import('next').NextConfig} */
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BACKEND_INTERNAL = "http://backend:3041";

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../"),
  async rewrites() {
    return [
      { source: "/auth/:path*",    destination: `${BACKEND_INTERNAL}/auth/:path*`    },
      { source: "/api/:path*",     destination: `${BACKEND_INTERNAL}/api/:path*`     },
      { source: "/members/:path*", destination: `${BACKEND_INTERNAL}/members/:path*` },
    ];
  },
  images: {
    remotePatterns: [
      {
        hostname: "drive.google.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};
export default nextConfig;
