import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { isClerkConfigured, isDevAuthBypass } from "@/lib/auth-config";
import {
  SESSION_COOKIE,
  verifyLocalSession,
} from "@/features/auth/lib/session-crypto";
import { publicUrl } from "@/lib/request-origin";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health(.*)",
  "/api/auth/login(.*)",
  "/api/webhooks(.*)",
  "/api/cron(.*)",
  "/api/billing/mercadopago/webhook(.*)",
  // Única vista de turnero sin login
  "/turnero/pantalla(.*)",
  "/api/turnero/pantalla(.*)",
]);

const withClerk = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export default async function middleware(
  request: NextRequest,
  event: NextFetchEvent,
) {
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const local = await verifyLocalSession(token);
    if (local) {
      return NextResponse.next();
    }
  }

  if (isDevAuthBypass()) {
    return NextResponse.next();
  }

  if (isClerkConfigured()) {
    return withClerk(request, event);
  }

  const signIn = publicUrl(request, "/sign-in");
  signIn.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
