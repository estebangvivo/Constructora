import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/features/auth/lib/password";
import {
  SESSION_COOKIE,
} from "@/features/auth/lib/session-crypto";
import { issueLocalSessionToken } from "@/features/auth/lib/session";
import { publicUrl } from "@/lib/request-origin";
import { isPlatformSuperadminEmail } from "@/features/auth/lib/platform-admin";

export const dynamic = "force-dynamic";

function cookieSecure() {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.FORCE_INSECURE_COOKIES !== "true"
  );
}

/** Cookie de sesión del navegador (sin maxAge): se borra al cerrar el browser. */
function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecure(),
    path: "/",
  };
}

async function authenticate(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !password) {
    return { ok: false as const, error: "Completá email y contraseña." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    return { ok: false as const, error: "Credenciales inválidas." };
  }
  if (!user.passwordHash) {
    return {
      ok: false as const,
      error:
        "Este usuario no tiene contraseña local. Pedile a un admin que la defina.",
    };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { ok: false as const, error: "Credenciales inválidas." };
  }

  const isSuperadmin = isPlatformSuperadminEmail(user.email);

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });

  // Superadmin entra sin empresa activa; elige una después si quiere operar un tenant.
  // bumpSession: cierra otras sesiones del mismo usuario (no aplica a superadmin).
  const token = await issueLocalSessionToken({
    userId: user.id,
    organizationId: isSuperadmin
      ? null
      : (memberships[0]?.organizationId ?? null),
    bumpSession: true,
  });

  return {
    ok: true as const,
    token,
    isPlatformSuperadmin: isSuperadmin,
    needsOrgPicker: !isSuperadmin && memberships.length > 1,
    needsOnboarding: !isSuperadmin && memberships.length === 0,
  };
}

/** Login compatible con Silk / tablets (sin Server Actions). */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let email = "";
    let password = "";
    let wantsJson = contentType.includes("application/json");

    if (wantsJson) {
      const body = (await request.json()) as {
        email?: string;
        password?: string;
      };
      email = String(body.email ?? "");
      password = String(body.password ?? "");
    } else {
      const form = await request.formData();
      email = String(form.get("email") ?? "");
      password = String(form.get("password") ?? "");
      wantsJson = form.get("ajax") === "1";
    }

    const result = await authenticate(email, password);

    if (!result.ok) {
      if (wantsJson) {
        return NextResponse.json(
          { ok: false, error: result.error },
          { status: 401 },
        );
      }
      const url = publicUrl(request, "/sign-in");
      url.searchParams.set("error", result.error);
      return NextResponse.redirect(url, 303);
    }

    const dest = result.isPlatformSuperadmin
      ? "/admin"
      : result.needsOnboarding
        ? "/onboarding/planes"
        : result.needsOrgPicker
          ? "/select-organization?required=1"
          : "/";

    if (wantsJson) {
      const res = NextResponse.json({
        ok: true,
        needsOrgPicker: result.needsOrgPicker,
        needsOnboarding: result.needsOnboarding,
        isPlatformSuperadmin: result.isPlatformSuperadmin,
        redirectTo: dest,
      });
      res.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
      return res;
    }

    const res = NextResponse.redirect(publicUrl(request, dest), 303);
    res.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
    return res;
  } catch (error) {
    console.error("POST /api/auth/login", error);
    if (request.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: "No se pudo iniciar sesión." },
        { status: 500 },
      );
    }
    const url = publicUrl(request, "/sign-in");
    url.searchParams.set("error", "No se pudo iniciar sesión.");
    return NextResponse.redirect(url, 303);
  }
}
