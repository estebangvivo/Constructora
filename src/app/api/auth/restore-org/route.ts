import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSession } from "@/lib/auth";
import {
  SESSION_COOKIE,
  signLocalSession,
} from "@/features/auth/lib/session-crypto";
import { publicUrl } from "@/lib/request-origin";
import { isPlatformSuperadmin } from "@/features/auth/lib/platform-admin";

export const dynamic = "force-dynamic";

function cookieSecure() {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.FORCE_INSECURE_COOKIES !== "true"
  );
}

/**
 * Restaura la empresa en la cookie cuando hay membresía pero la sesión quedó sin org.
 * (No se puede setear cookies desde un layout.)
 */
export async function GET(request: Request) {
  try {
    const session = await requireAuthSession();

    if (isPlatformSuperadmin(session) && !session.organizationId) {
      return NextResponse.redirect(publicUrl(request, "/admin"));
    }

    if (session.organizationId) {
      return NextResponse.redirect(publicUrl(request, "/"));
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.redirect(publicUrl(request, "/onboarding/planes"));
    }

    const token = await signLocalSession({
      userId: session.user.id,
      organizationId: membership.organizationId,
    });

    const res = NextResponse.redirect(publicUrl(request, "/"), 303);
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure(),
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.redirect(publicUrl(request, "/sign-in"), 303);
  }
}
