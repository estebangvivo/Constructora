"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthSession } from "@/lib/auth";
import { activateBillingPayment } from "@/features/billing/lib/activate";
import {
  setLocalSessionCookie,
  signLocalSession,
} from "@/features/auth/lib/session";
import { isPlatformSuperadmin } from "@/features/auth/lib/platform-admin";

async function assertPlatformBillingAdmin(userId: string, email: string) {
  if (isPlatformSuperadmin({ user: { email } })) return;

  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      role: "ADMIN",
      organization: { billingStatus: "EXEMPT" },
    },
  });
  if (!membership) {
    throw new Error("FORBIDDEN");
  }
}

export async function listPendingBillingPayments() {
  const session = await requireAuthSession();
  try {
    await assertPlatformBillingAdmin(session.user.id, session.user.email);
  } catch {
    return [];
  }

  const payments = await prisma.billingPayment.findMany({
    where: { status: "PENDING", method: "TRANSFER" },
    include: {
      user: {
        select: { email: true, firstName: true, lastName: true },
      },
      organization: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return payments.map((p) => ({
    id: p.id,
    plan: p.plan,
    method: p.method,
    currency: p.currency,
    amount: Number(p.amount),
    fxRateUsed: p.fxRateUsed ? Number(p.fxRateUsed) : null,
    companyName: p.companyName,
    companySlug: p.companySlug,
    organizationId: p.organizationId,
    organizationName: p.organization?.name ?? null,
    transferProofUrl: p.transferProofUrl,
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
    userEmail: p.user.email,
    userName:
      [p.user.firstName, p.user.lastName].filter(Boolean).join(" ") ||
      p.user.email,
  }));
}

export async function approveBillingPayment(
  paymentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireAuthSession();
    await assertPlatformBillingAdmin(session.user.id, session.user.email);

    const updated = await activateBillingPayment(paymentId, {
      approvedById: session.user.id,
    });

    // Si el aprobador no es el pagador, no tocamos su cookie.
    // Si el pagador está logueado en otro lado, al refrescar verá la org.
    if (updated.organizationId && updated.userId === session.user.id) {
      const token = await signLocalSession({
        userId: session.user.id,
        organizationId: updated.organizationId,
      });
      await setLocalSessionCookie(token);
    }

    revalidatePath("/admin");
    revalidatePath("/billing");
    revalidatePath("/onboarding/pago");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    console.error("approveBillingPayment", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo aprobar el pago.",
    };
  }
}

export async function rejectBillingPayment(
  paymentId: string,
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireAuthSession();
    await assertPlatformBillingAdmin(session.user.id, session.user.email);

    const payment = await prisma.billingPayment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || payment.status !== "PENDING") {
      return { ok: false, error: "Pago no pendiente." };
    }

    await prisma.billingPayment.update({
      where: { id: paymentId },
      data: {
        status: "REJECTED",
        approvedById: session.user.id,
        notes: [payment.notes, reason ? `Rechazo: ${reason}` : null]
          .filter(Boolean)
          .join("\n"),
      },
    });

    if (payment.organizationId) {
      await prisma.organization.update({
        where: { id: payment.organizationId },
        data: { billingStatus: "PAST_DUE" },
      });
    }

    revalidatePath("/admin");
    revalidatePath("/billing");
    return { ok: true };
  } catch (error) {
    console.error("rejectBillingPayment", error);
    return { ok: false, error: "No se pudo rechazar el pago." };
  }
}
