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
  "/api/auth/session-gate(.*)",
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
      // Sesión única: confirmar que el JWT no fue reemplazado por otro login.
      try {
        const gateUrl = new URL("/api/auth/session-gate", request.url);
        const gateRes = await fetch(gateUrl, {
          headers: {
            cookie: request.headers.get("cookie") ?? "",
          },
          cache: "no-store",
        });
        if (gateRes.status === 401) {
          const signIn = publicUrl(request, "/sign-in");
          signIn.searchParams.set("next", request.nextUrl.pathname);
          signIn.searchParams.set("reason", "session");
          const redirect = NextResponse.redirect(signIn);
          redirect.cookies.set(SESSION_COOKIE, "", {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 0,
          });
          return redirect;
        }
      } catch (error) {
        console.warn("middleware session-gate", error);
      }

      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-pathname", request.nextUrl.pathname);
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
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
