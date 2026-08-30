/**
 * Sentinel Hub API providers. Both serve the same Process/Catalog/Statistical
 * APIs and the same sentinel-2-l2a collection; they differ only in host,
 * token endpoint, credentials, and quota model:
 *  - cdse:   Copernicus Data Space Ecosystem free tier (40k PU/month).
 *  - planet: commercial Sentinel Hub sold by Planet (30-day trial, then paid
 *            plans) — the scale-up path when free quota binds.
 */

export interface ShProvider {
  name: string;
  tokenUrl: string;
  apiBase: string;
  clientIdEnv: string;
  clientSecretEnv: string;
}

export const PROVIDERS: Record<string, ShProvider> = {
  cdse: {
    name: "cdse",
    tokenUrl:
      "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
    apiBase: "https://sh.dataspace.copernicus.eu/api/v1",
    clientIdEnv: "CDSE_CLIENT_ID",
    clientSecretEnv: "CDSE_CLIENT_SECRET",
  },
  planet: {
    name: "planet",
    tokenUrl:
      "https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token",
    apiBase: "https://services.sentinel-hub.com/api/v1",
    clientIdEnv: "PLANET_SH_CLIENT_ID",
    clientSecretEnv: "PLANET_SH_CLIENT_SECRET",
  },
};

export function getProvider(name?: string): ShProvider {
  const provider = PROVIDERS[name ?? "cdse"];
  if (!provider) {
    throw new Error(
      `Unknown provider "${name}". Available: ${Object.keys(PROVIDERS).join(", ")}`
    );
  }
  return provider;
}
