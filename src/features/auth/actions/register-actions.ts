"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/features/auth/lib/password";
import {
  setLocalSessionCookie,
  signLocalSession,
} from "@/features/auth/lib/session";

export type RegisterResult =
  | { ok: true; needsOnboarding: true }
  | { ok: false; error: string };

/** Registro público local (sin empresa). Luego va a onboarding/pago. */
export async function registerWithPassword(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<RegisterResult> {
  try {
    const email = input.email.trim().toLowerCase();
    const password = input.password;
    if (!email || !password) {
      return { ok: false, error: "Completá email y contraseña." };
    }
    if (password.length < 6) {
      return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return {
        ok: false,
        error: "Ya existe una cuenta con ese email. Iniciá sesión.",
      };
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        authId: `local:${email}`,
        email,
        passwordHash,
        firstName: input.firstName?.trim() || null,
        lastName: input.lastName?.trim() || null,
        lastSeenAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    const token = await signLocalSession({
      userId: user.id,
      organizationId: null,
    });
    await setLocalSessionCookie(token);
    revalidatePath("/", "layout");
    return { ok: true, needsOnboarding: true };
  } catch (error) {
    console.error("registerWithPassword", error);
    return { ok: false, error: "No se pudo crear la cuenta." };
  }
}
