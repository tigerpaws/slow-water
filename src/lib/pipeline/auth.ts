import { requireEnv } from "./env";

const TOKEN_URL =
  "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";

let cached: { token: string; expiresAt: number } | null = null;

/**
 * OAuth2 client-credentials token for CDSE Sentinel Hub APIs. Cached until
 * shortly before expiry — CDSE rate-limits token requests, so never fetch one
 * per API call.
 */
export async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: requireEnv("CDSE_CLIENT_ID"),
      client_secret: requireEnv("CDSE_CLIENT_SECRET"),
    }),
  });
  if (!res.ok) {
    throw new Error(`CDSE token request failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}
