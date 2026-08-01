"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  validatePasswordStrength,
} from "@/features/auth/lib/password";
import {
  setLocalSessionCookie,
  signLocalSession,
} from "@/features/auth/lib/session";
import { isValidWhatsAppPhone } from "@/features/treasury/lib/share-message";

export type RegisterResult =
  | { ok: true; needsOnboarding: true }
  | { ok: false; error: string };

/** Registro público local (sin empresa). Luego va a onboarding/pago. */
export async function registerWithPassword(input: {
  email: string;
  password: string;
  confirmPassword?: string;
  phone: string;
  firstName?: string;
  lastName?: string;
}): Promise<RegisterResult> {
  try {
    const email = input.email.trim().toLowerCase();
    const password = input.password;
    const phone = input.phone.trim();
    if (!email || !password) {
      return { ok: false, error: "Completá email y contraseña." };
    }
    const strength = validatePasswordStrength(password);
    if (!strength.ok) return strength;
    if (
      input.confirmPassword != null &&
      password !== input.confirmPassword
    ) {
      return { ok: false, error: "Las contraseñas no coinciden." };
    }
    if (!phone) {
      return { ok: false, error: "Indicá tu teléfono celular." };
    }
    if (!isValidWhatsAppPhone(phone)) {
      return {
        ok: false,
        error:
          "Teléfono inválido. Usá código de área (ej. 11 5555-5555 o +54 9 11 …).",
      };
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
        phone,
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
