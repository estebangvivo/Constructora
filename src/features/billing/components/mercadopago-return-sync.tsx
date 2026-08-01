"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { syncMercadoPagoCheckoutReturn } from "@/features/billing/actions/billing-actions";

type Props = {
  paymentId?: string | null;
  collectionId?: string | null;
  externalReference?: string | null;
  status?: string | null;
  preferenceId?: string | null;
  /** Si hay activación, ir acá (default /). */
  successHref?: string;
};

/**
 * Confirma el pago al volver de MP (cuando el webhook no llegó a tiempo).
 */
export function MercadoPagoReturnSync({
  paymentId,
  collectionId,
  externalReference,
  status,
  preferenceId,
  successHref = "/",
}: Props) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      const result = await syncMercadoPagoCheckoutReturn({
        paymentId,
        collectionId,
        externalReference,
        status,
        preferenceId,
      });
      if (result.ok && result.activated) {
        router.replace(successHref);
        router.refresh();
        return;
      }
      router.refresh();
    })();
  }, [
    paymentId,
    collectionId,
    externalReference,
    status,
    preferenceId,
    successHref,
    router,
  ]);

  return (
    <p className="rounded-md border border-border bg-surface/40 px-3 py-2 text-sm text-muted-foreground">
      Confirmando pago con Mercado Pago…
    </p>
  );
}
