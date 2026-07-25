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
  | { ok: true }
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

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) {
      return { ok: false, error: "El usuario no pertenece a ninguna empresa." };
    }

    const token = await signLocalSession({
      userId: user.id,
      organizationId: membership.organizationId,
    });
    await setLocalSessionCookie(token);

    revalidatePath("/", "layout");
    return { ok: true };
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
