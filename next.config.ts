import type { NextConfig } from "next";

// Fail fast, at build and at server start: a production server without
// SITE_PASSWORD would serve a chat that can never authenticate (src/proxy.ts
// fails closed). src/instrumentation.ts re-checks at runtime for platforms
// where build-time and runtime env differ.
if (process.env.NODE_ENV === "production" && !process.env.SITE_PASSWORD) {
  throw new Error(
    "SITE_PASSWORD is not set — the chat gate needs it in production. " +
      "Set the env var (see .env.example) and rebuild/restart."
  );
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
