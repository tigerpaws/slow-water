import { getAccessToken } from "./auth";
import type { ShProvider } from "./providers";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Running total of processing units reported by response headers. */
let puSpent = 0;
export function processingUnitsSpent(): number {
  return puSpent;
}

/**
 * Authenticated POST to a Sentinel Hub endpoint (path relative to the
 * provider's API base) with backoff on 429/5xx and network-level failures.
 * Returns the raw Response so callers can read binary or JSON bodies.
 */
export async function shPost(
  provider: ShProvider,
  path: string,
  body: unknown,
  accept: string
): Promise<Response> {
  const url = `${provider.apiBase}${path}`;
  let lastError = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(1500 * 2 ** attempt);
    const token = await getAccessToken(provider);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: accept,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      // Network-level failures (closed keep-alive sockets, resets) are retryable.
      lastError = err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message) : String(err);
      continue;
    }
    if (res.ok) {
      const pu = Number(res.headers.get("x-processingunits-spent"));
      if (!Number.isNaN(pu)) puSpent += pu;
      return res;
    }
    lastError = `${res.status} ${await res.text()}`;
    if (res.status !== 429 && res.status < 500) break;
  }
  throw new Error(`Sentinel Hub request to ${url} failed: ${lastError}`);
}
