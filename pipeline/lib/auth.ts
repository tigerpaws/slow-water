import { requireEnv } from "./env";
import type { ShProvider } from "./providers";

const cache = new Map<string, { token: string; expiresAt: number }>();

/**
 * OAuth2 client-credentials token for a Sentinel Hub provider. Cached until
 * shortly before expiry — token endpoints are rate-limited, so never fetch
 * one per API call.
 */
export async function getAccessToken(provider: ShProvider): Promise<string> {
  const cached = cache.get(provider.name);
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: requireEnv(provider.clientIdEnv),
      client_secret: requireEnv(provider.clientSecretEnv),
    }),
  });
  if (!res.ok) {
    throw new Error(
      `${provider.name} token request failed: ${res.status} ${await res.text()}`
    );
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cache.set(provider.name, {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  });
  return body.access_token;
}
