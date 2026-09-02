import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// A shared-password gate on the chat API — the one route that spends real
// API credit. The rest of the site stays open. This is not real security:
// one shared password, sent as a header over HTTPS, for a short-lived demo.
// The password lives only in the SITE_PASSWORD env var (never in the repo);
// if it's unset, the deployed chat fails closed.
const PASSWORD = process.env.SITE_PASSWORD;

export function proxy(request: NextRequest) {
  // Local dev stays open; the gate exists for the deployed site.
  if (process.env.NODE_ENV === "development") return NextResponse.next();
  if (PASSWORD && request.headers.get("x-site-password") === PASSWORD) return NextResponse.next();
  // No WWW-Authenticate header: the chat panel shows its own unlock prompt,
  // and we don't want the browser's native dialog on top of it.
  return new NextResponse("Password required.", { status: 401 });
}

export const config = { matcher: ["/api/chat"] };
