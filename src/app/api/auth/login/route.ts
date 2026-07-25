import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/features/auth/lib/password";
import {
  SESSION_COOKIE,
  signLocalSession,
} from "@/features/auth/lib/session-crypto";

export const dynamic = "force-dynamic";

function cookieSecure() {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.FORCE_INSECURE_COOKIES !== "true"
  );
}

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecure(),
    path: "/",
    maxAge,
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

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) {
    return {
      ok: false as const,
      error: "El usuario no pertenece a ninguna empresa.",
    };
  }

  const token = await signLocalSession({
    userId: user.id,
    organizationId: membership.organizationId,
  });

  return { ok: true as const, token };
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
      // form HTML clásico → redirect
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
      const url = new URL("/sign-in", request.url);
      url.searchParams.set("error", result.error);
      return NextResponse.redirect(url, 303);
    }

    if (wantsJson) {
      const res = NextResponse.json({ ok: true });
      res.cookies.set(
        SESSION_COOKIE,
        result.token,
        sessionCookieOptions(60 * 60 * 24 * 14),
      );
      return res;
    }

    const res = NextResponse.redirect(new URL("/", request.url), 303);
    res.cookies.set(
      SESSION_COOKIE,
      result.token,
      sessionCookieOptions(60 * 60 * 24 * 14),
    );
    return res;
  } catch (error) {
    console.error("POST /api/auth/login", error);
    if (request.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: "No se pudo iniciar sesión." },
        { status: 500 },
      );
    }
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("error", "No se pudo iniciar sesión.");
    return NextResponse.redirect(url, 303);
  }
}
