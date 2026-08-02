import { formatDateAR } from "@/lib/format-date";

type PlanSpecialDiscountBadgeProps = {
  discountPercent: number | null | undefined;
  discountUntil: string | null | undefined;
  discountPromoMonths?: number | null | undefined;
  className?: string;
};

/** Badge “Descuento especial” con %, meses de promo y fecha límite para contratar. */
export function PlanSpecialDiscountBadge({
  discountPercent,
  discountUntil,
  discountPromoMonths,
  className,
}: PlanSpecialDiscountBadgeProps) {
  if (
    discountPercent == null ||
    discountPercent <= 0 ||
    !discountUntil
  ) {
    return null;
  }

  const monthsLabel =
    discountPromoMonths != null && discountPromoMonths > 0
      ? discountPromoMonths === 1
        ? "1 mes"
        : `${discountPromoMonths} meses`
      : null;

  return (
    <div
      className={
        className ??
        "rounded-md border border-amber-700/35 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-950"
      }
    >
      <p className="font-semibold tracking-tight">
        Descuento especial · {discountPercent}% OFF
        {monthsLabel ? ` · ${monthsLabel}` : ""}
      </p>
      <p className="mt-0.5 opacity-90">
        Solo para empresas nuevas · contratá hasta{" "}
        {formatDateAR(discountUntil)}
        {monthsLabel
          ? `. En planes mensuales, el descuento dura ${monthsLabel}; después el precio vuelve al valor completo.`
          : "."}
      </p>
    </div>
  );
}
