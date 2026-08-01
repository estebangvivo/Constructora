import Link from "next/link";
import { Clock } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  organizationIsTrialPlan,
  trialDaysRemaining,
} from "@/features/billing/lib/access";

function daysCopy(days: number): string {
  if (days <= 0) return "Tu prueba gratis termina hoy";
  if (days === 1) return "Te queda 1 día de prueba gratis";
  return `Te quedan ${days} días de prueba gratis`;
}

/** Banner global: aviso de prueba activa + CTA a planes. */
export async function TrialAlertBanner() {
  const session = await getSession().catch(() => null);
  if (!session?.organizationId) return null;

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      billingStatus: true,
      billingPlan: true,
      paidUntil: true,
    },
  });
  if (!org || !organizationIsTrialPlan(org)) return null;

  const days = trialDaysRemaining(org.paidUntil);
  if (days == null) return null;

  const urgent = days <= 7;

  return (
    <div
      role="status"
      className={
        urgent
          ? "sticky top-0 z-30 border-b border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[#7f1d1d] print:hidden lg:px-6"
          : "sticky top-0 z-30 border-b border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-[#78350f] print:hidden lg:px-6"
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2.5">
          <Clock
            className={
              urgent
                ? "mt-0.5 size-5 shrink-0 text-[#b91c1c]"
                : "mt-0.5 size-5 shrink-0 text-[#b45309]"
            }
            aria-hidden
          />
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium">{daysCopy(days)}</p>
            <p
              className={
                urgent
                  ? "text-sm text-[#9f1239]"
                  : "text-sm text-[#92400e]"
              }
            >
              Durante la prueba no podés dar de alta usuarios. Contratá un plan
              para sumar personas a la empresa.
            </p>
          </div>
        </div>
        <Link
          href="/billing"
          className={
            urgent
              ? "shrink-0 self-start rounded-md border border-[#fecaca] bg-white px-3 py-1.5 text-sm font-medium text-[#7f1d1d] hover:bg-[#fff1f2]"
              : "shrink-0 self-start rounded-md border border-[#fde68a] bg-white px-3 py-1.5 text-sm font-medium text-[#78350f] hover:bg-[#fef3c7]"
          }
        >
          Ver planes
        </Link>
      </div>
    </div>
  );
}
