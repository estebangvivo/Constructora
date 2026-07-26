"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { postBankMovement } from "@/features/treasury/lib/bank-from-treasury";
import {
  ensureCashRegisters,
  toNumber,
} from "@/features/treasury/lib/cash-helpers";
import { round2 } from "@/features/treasury/lib/cash-labels";
import { formatMoney } from "@/features/treasury/lib/labels";
import { syncBudgetItemsFromTreasury } from "@/features/treasury/lib/helpers";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function canManage(role: string) {
  return ["ADMIN", "DIRECTOR", "RESIDENT"].includes(role);
}

function revalidateDeposit(bankAccountId: string) {
  revalidatePath("/treasury");
  revalidatePath("/treasury/banks");
  revalidatePath(`/treasury/banks/${bankAccountId}`);
  revalidatePath("/treasury/banks/deposit");
  revalidatePath("/treasury/cash");
  revalidatePath("/treasury/cash/treasury");
  revalidatePath("/treasury/checks");
  revalidatePath("/", "layout");
}

/** Depósito de efectivo (caja diaria o tesorería) a una cuenta bancaria. */
export async function depositCashToBank(input: {
  bankAccountId: string;
  amount: number;
  cashSource: "DAILY" | "TREASURY";
  notes?: string;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const amount = round2(Math.abs(Number(input.amount) || 0));
    if (amount <= 0) {
      return { ok: false, error: "Ingresá un monto mayor a cero." };
    }

    const bank = await prisma.bankAccount.findFirst({
      where: {
        id: input.bankAccountId,
        organizationId: session.organizationId,
        isActive: true,
      },
    });
    if (!bank) return { ok: false, error: "Cuenta bancaria no encontrada." };

    const notes = input.notes?.trim() || null;
    const sourceLabel =
      input.cashSource === "DAILY" ? "caja diaria" : "caja tesorería";

    await prisma.$transaction(async (tx) => {
      const { daily, treasury } = await ensureCashRegisters(
        session.organizationId,
        bank.currency,
        tx,
      );

      if (input.cashSource === "DAILY") {
        const openSession = await tx.cashSession.findFirst({
          where: {
            organizationId: session.organizationId,
            registerId: daily.id,
            status: "OPEN",
            currency: bank.currency,
          },
        });
        if (!openSession) {
          throw new Error(
            `No hay caja diaria abierta en ${bank.currency}. Abrila o depositá desde caja tesorería.`,
          );
        }
        if (amount > toNumber(daily.balance) + 0.001) {
          throw new Error(
            `Saldo insuficiente en caja diaria (${formatMoney(toNumber(daily.balance), bank.currency)}).`,
          );
        }

        const balanceAfter = round2(toNumber(daily.balance) - amount);
        await tx.cashMovement.create({
          data: {
            organizationId: session.organizationId,
            registerId: daily.id,
            sessionId: openSession.id,
            type: "BANK_DEPOSIT",
            amount: -amount,
            balanceAfter,
            description: `Depósito a ${bank.name}${notes ? ` · ${notes}` : ""}`,
            createdById: session.user.id,
          },
        });
        await tx.cashRegister.update({
          where: { id: daily.id },
          data: { balance: balanceAfter },
        });
      } else {
        if (amount > toNumber(treasury.balance) + 0.001) {
          throw new Error(
            `Saldo insuficiente en caja tesorería (${formatMoney(toNumber(treasury.balance), bank.currency)}).`,
          );
        }
        const balanceAfter = round2(toNumber(treasury.balance) - amount);
        await tx.cashMovement.create({
          data: {
            organizationId: session.organizationId,
            registerId: treasury.id,
            type: "BANK_DEPOSIT",
            amount: -amount,
            balanceAfter,
            description: `Depósito a ${bank.name}${notes ? ` · ${notes}` : ""}`,
            createdById: session.user.id,
          },
        });
        await tx.cashRegister.update({
          where: { id: treasury.id },
          data: { balance: balanceAfter },
        });
      }

      await postBankMovement(tx, {
        organizationId: session.organizationId,
        bankAccountId: bank.id,
        amount,
        kind: "DEPOSIT",
        description: `Depósito efectivo desde ${sourceLabel}${notes ? ` · ${notes}` : ""}`,
        currency: bank.currency,
        createdById: session.user.id,
      });
    });

    revalidateDeposit(bank.id);
    return { ok: true, id: bank.id };
  } catch (error) {
    console.error("depositCashToBank", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo registrar el depósito.",
    };
  }
}

/** Depósito de cheques en cartera a una cuenta bancaria. */
export async function depositChecksToBank(input: {
  bankAccountId: string;
  checkIds: string[];
  notes?: string;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const checkIds = [...new Set(input.checkIds.filter(Boolean))];
    if (checkIds.length === 0) {
      return { ok: false, error: "Elegí al menos un cheque de la cartera." };
    }

    const bank = await prisma.bankAccount.findFirst({
      where: {
        id: input.bankAccountId,
        organizationId: session.organizationId,
        isActive: true,
      },
    });
    if (!bank) return { ok: false, error: "Cuenta bancaria no encontrada." };

    const notes = input.notes?.trim() || null;

    await prisma.$transaction(async (tx) => {
      const checks = await tx.checkInstrument.findMany({
        where: {
          id: { in: checkIds },
          organizationId: session.organizationId,
        },
      });
      if (checks.length !== checkIds.length) {
        throw new Error("Uno o más cheques no se encontraron.");
      }

      for (const check of checks) {
        if (check.status !== "IN_PORTFOLIO") {
          throw new Error(
            `El cheque ${check.number} (${check.bank}) no está disponible en cartera.`,
          );
        }
        if (check.currency.toUpperCase() !== bank.currency.toUpperCase()) {
          throw new Error(
            `El cheque ${check.number} está en ${check.currency}; la cuenta opera en ${bank.currency}.`,
          );
        }

        const amount = toNumber(check.amount);
        await tx.checkInstrument.update({
          where: { id: check.id },
          data: {
            status: "DEPOSITED",
            depositedBankAccountId: bank.id,
            depositedAt: new Date(),
          },
        });

        await postBankMovement(tx, {
          organizationId: session.organizationId,
          bankAccountId: bank.id,
          amount,
          kind: "DEPOSIT",
          description: `Depósito cheque ${check.number} · ${check.bank}${notes ? ` · ${notes}` : ""}`,
          currency: bank.currency,
          checkInstrumentId: check.id,
          createdById: session.user.id,
        });
      }
    });

    revalidateDeposit(bank.id);
    return { ok: true, id: bank.id };
  } catch (error) {
    console.error("depositChecksToBank", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo depositar los cheques.",
    };
  }
}

/** Extracción de efectivo de una cuenta bancaria hacia caja diaria o tesorería. */
export async function withdrawCashFromBank(input: {
  bankAccountId: string;
  amount: number;
  cashDestination: "DAILY" | "TREASURY";
  notes?: string;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const amount = round2(Math.abs(Number(input.amount) || 0));
    if (amount <= 0) {
      return { ok: false, error: "Ingresá un monto mayor a cero." };
    }

    const bank = await prisma.bankAccount.findFirst({
      where: {
        id: input.bankAccountId,
        organizationId: session.organizationId,
        isActive: true,
      },
    });
    if (!bank) return { ok: false, error: "Cuenta bancaria no encontrada." };

    if (amount > toNumber(bank.balance) + 0.001) {
      return {
        ok: false,
        error: `Saldo insuficiente en ${bank.name} (${formatMoney(toNumber(bank.balance), bank.currency)}).`,
      };
    }

    const notes = input.notes?.trim() || null;
    const destLabel =
      input.cashDestination === "DAILY" ? "caja diaria" : "caja tesorería";

    await prisma.$transaction(async (tx) => {
      const { daily, treasury } = await ensureCashRegisters(
        session.organizationId,
        bank.currency,
        tx,
      );

      if (input.cashDestination === "DAILY") {
        const openSession = await tx.cashSession.findFirst({
          where: {
            organizationId: session.organizationId,
            registerId: daily.id,
            status: "OPEN",
            currency: bank.currency,
          },
        });
        if (!openSession) {
          throw new Error(
            `No hay caja diaria abierta en ${bank.currency}. Abrila o destiná la extracción a caja tesorería.`,
          );
        }

        const balanceAfter = round2(toNumber(daily.balance) + amount);
        await tx.cashMovement.create({
          data: {
            organizationId: session.organizationId,
            registerId: daily.id,
            sessionId: openSession.id,
            type: "BANK_WITHDRAWAL",
            amount,
            balanceAfter,
            description: `Extracción de ${bank.name}${notes ? ` · ${notes}` : ""}`,
            createdById: session.user.id,
          },
        });
        await tx.cashRegister.update({
          where: { id: daily.id },
          data: { balance: balanceAfter },
        });
      } else {
        const balanceAfter = round2(toNumber(treasury.balance) + amount);
        await tx.cashMovement.create({
          data: {
            organizationId: session.organizationId,
            registerId: treasury.id,
            type: "BANK_WITHDRAWAL",
            amount,
            balanceAfter,
            description: `Extracción de ${bank.name}${notes ? ` · ${notes}` : ""}`,
            createdById: session.user.id,
          },
        });
        await tx.cashRegister.update({
          where: { id: treasury.id },
          data: { balance: balanceAfter },
        });
      }

      await postBankMovement(tx, {
        organizationId: session.organizationId,
        bankAccountId: bank.id,
        amount,
        kind: "WITHDRAWAL",
        description: `Extracción efectivo a ${destLabel}${notes ? ` · ${notes}` : ""}`,
        currency: bank.currency,
        createdById: session.user.id,
      });
    });

    revalidateDeposit(bank.id);
    return { ok: true, id: bank.id };
  } catch (error) {
    console.error("withdrawCashFromBank", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo registrar la extracción.",
    };
  }
}

export type CheckRejectionFeeInput = {
  description: string;
  amount: number;
  projectId?: string | null;
  budgetItemId?: string | null;
};

/** Registra el rechazo de un cheque ya depositado (y gastos asociados). */
export async function bounceDepositedCheck(input: {
  checkId: string;
  reason?: string;
  fees?: CheckRejectionFeeInput[];
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManage(session.organizationRole)) {
      return { ok: false, error: "Sin permiso." };
    }

    const reason = input.reason?.trim() || null;
    const fees = (input.fees ?? [])
      .map((f) => ({
        description: f.description?.trim() || "",
        amount: round2(Math.abs(Number(f.amount) || 0)),
        projectId: f.projectId?.trim() || null,
        budgetItemId: f.budgetItemId?.trim() || null,
      }))
      .filter((f) => f.amount > 0);

    for (const fee of fees) {
      if (!fee.description) {
        return {
          ok: false,
          error: "Cada gasto del rechazo necesita una descripción.",
        };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const check = await tx.checkInstrument.findFirst({
        where: {
          id: input.checkId,
          organizationId: session.organizationId,
        },
        include: {
          receipt: {
            select: {
              id: true,
              number: true,
              lines: {
                select: {
                  budgetItemId: true,
                  projectId: true,
                },
              },
            },
          },
        },
      });
      if (!check) throw new Error("Cheque no encontrado.");
      if (check.status !== "DEPOSITED") {
        throw new Error(
          "Solo se pueden rechazar cheques que ya fueron depositados.",
        );
      }
      if (!check.depositedBankAccountId) {
        throw new Error(
          "El cheque no tiene cuenta de depósito asociada.",
        );
      }

      const amount = toNumber(check.amount);
      const receiptLineKeys = new Set(
        (check.receipt?.lines ?? []).map(
          (l) => `${l.projectId ?? ""}:${l.budgetItemId ?? ""}`,
        ),
      );

      for (const fee of fees) {
        if (!fee.budgetItemId && !fee.projectId) continue;
        if (!fee.budgetItemId || !fee.projectId) {
          throw new Error(
            "Los gastos del rechazo deben indicar obra y partida.",
          );
        }
        const key = `${fee.projectId}:${fee.budgetItemId}`;
        if (receiptLineKeys.size > 0 && !receiptLineKeys.has(key)) {
          throw new Error(
            "La partida del gasto debe coincidir con una imputación del recibo.",
          );
        }
        const item = await tx.budgetItem.findFirst({
          where: {
            id: fee.budgetItemId,
            budget: {
              projectId: fee.projectId,
              project: { organizationId: session.organizationId },
            },
          },
          select: { id: true },
        });
        if (!item) {
          throw new Error("Partida de presupuesto no encontrada.");
        }
      }

      await postBankMovement(tx, {
        organizationId: session.organizationId,
        bankAccountId: check.depositedBankAccountId,
        amount,
        kind: "BOUNCE",
        description: `Rechazo cheque ${check.number} · ${check.bank}${
          reason ? ` · ${reason}` : ""
        }${check.receipt ? ` · ${check.receipt.number}` : ""}`,
        currency: check.currency,
        checkInstrumentId: check.id,
        receiptId: check.receiptId ?? undefined,
        createdById: session.user.id,
      });

      for (const fee of fees) {
        await postBankMovement(tx, {
          organizationId: session.organizationId,
          bankAccountId: check.depositedBankAccountId!,
          amount: fee.amount,
          kind: "EXPENSE",
          description: `Gasto rechazo cheque ${check.number} · ${fee.description}`,
          currency: check.currency,
          checkInstrumentId: check.id,
          receiptId: check.receiptId ?? undefined,
          createdById: session.user.id,
        });

        await tx.checkRejectionFee.create({
          data: {
            organizationId: session.organizationId,
            checkInstrumentId: check.id,
            description: fee.description,
            amount: fee.amount,
            currency: check.currency,
            projectId: fee.projectId,
            budgetItemId: fee.budgetItemId,
          },
        });
      }

      await tx.checkInstrument.update({
        where: { id: check.id },
        data: {
          status: "BOUNCED",
          bouncedAt: new Date(),
          bounceReason: reason,
        },
      });

      const budgetItemIds = [
        ...(check.receipt?.lines.map((l) => l.budgetItemId) ?? []),
        ...fees.map((f) => f.budgetItemId),
      ];
      await syncBudgetItemsFromTreasury(
        tx,
        session.organizationId,
        budgetItemIds,
      );

      return {
        bankAccountId: check.depositedBankAccountId,
        projectIds: [
          ...(check.receipt?.lines.map((l) => l.projectId) ?? []),
          ...fees.map((f) => f.projectId),
        ].filter((id): id is string => Boolean(id)),
      };
    });

    revalidateDeposit(result.bankAccountId);
    for (const projectId of [...new Set(result.projectIds)]) {
      revalidatePath(`/projects/${projectId}`);
      revalidatePath(`/projects/${projectId}/budget`);
    }
    return { ok: true, id: input.checkId };
  } catch (error) {
    console.error("bounceDepositedCheck", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo registrar el rechazo.",
    };
  }
}
