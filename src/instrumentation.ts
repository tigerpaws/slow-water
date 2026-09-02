// Startup guard: without SITE_PASSWORD a production server would serve a
// chat that always 401s (src/proxy.ts fails closed). Refuse to start
// instead, so a misconfigured deploy is caught immediately and loudly.
export function register() {
  if (process.env.NODE_ENV === "production" && !process.env.SITE_PASSWORD) {
    throw new Error(
      "SITE_PASSWORD is not set — the chat gate needs it in production. " +
        "Set the env var (see .env.example) and restart."
    );
  }
}
