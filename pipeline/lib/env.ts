import fs from "node:fs";
import path from "node:path";

/**
 * Minimal .env.local loader for CLI scripts (Next.js loads it itself for the
 * app, but tsx scripts run outside Next).
 */
export function loadEnv(): void {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, "");
  }
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing ${key}. Copy .env.example to .env.local and fill in your CDSE OAuth client credentials.`
    );
  }
  return value;
}
