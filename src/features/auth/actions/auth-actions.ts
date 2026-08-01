"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/features/auth/lib/password";
import {
  clearLocalSessionCookie,
  setLocalSessionCookie,
  signLocalSession,
} from "@/features/auth/lib/session";

export type AuthActionResult =
  | { ok: true; needsOrgPicker?: boolean; needsOnboarding?: boolean }
  | { ok: false; error: string };

export async function loginWithPassword(input: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  try {
    const email = input.email.trim().toLowerCase();
    const password = input.password;
    if (!email || !password) {
      return { ok: false, error: "Completá email y contraseña." };
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return { ok: false, error: "Credenciales inválidas." };
    }
    if (!user.passwordHash) {
      return {
        ok: false,
        error:
          "Este usuario no tiene contraseña local. Pedile a un admin que la defina.",
      };
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return { ok: false, error: "Credenciales inválidas." };
    }

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { organizationId: true },
    });

    const token = await signLocalSession({
      userId: user.id,
      organizationId: memberships[0]?.organizationId ?? null,
    });
    await setLocalSessionCookie(token);

    try {
      await prisma.$executeRaw`
        UPDATE users
        SET "lastSeenAt" = NOW(), "lastActivityAt" = NOW()
        WHERE id = ${user.id}
      `;
    } catch (error) {
      console.warn("loginWithPassword touch activity", error);
    }

    revalidatePath("/", "layout");
    return {
      ok: true,
      needsOrgPicker: memberships.length > 1,
      needsOnboarding: memberships.length === 0,
    };
  } catch (error) {
    console.error("loginWithPassword", error);
    return { ok: false, error: "No se pudo iniciar sesión." };
  }
}

export async function logoutLocal(): Promise<void> {
  await clearLocalSessionCookie();
  revalidatePath("/", "layout");
  redirect("/sign-in");
}
