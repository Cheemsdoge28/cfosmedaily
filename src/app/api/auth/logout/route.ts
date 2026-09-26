import { NextResponse, type NextRequest } from "next/server";

import { recordAudit } from "@/lib/audit";
import { destroySession, getSessionUser } from "@/lib/auth/session";

/**
 * Sign out.
 *
 * POST only, so a prefetch or an image tag cannot sign a user out, and the
 * Origin is checked because a session cookie alone must not authorise the
 * request from another site.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;

  if (origin && origin !== expected) {
    return new NextResponse("Cross-origin request rejected.", { status: 403 });
  }

  const user = await getSessionUser();
  await destroySession();

  if (user) {
    await recordAudit({
      action: "auth.logout",
      userId: user.id,
    });
  }

  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
