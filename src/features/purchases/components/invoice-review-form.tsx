"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deletePurchaseInvoice,
  setPurchaseInvoiceStatus,
  updatePurchaseInvoice,
  type InvoiceLineInput,
} from "@/features/purchases/actions/purchase-invoice-actions";
import type { PurchaseInvoiceDetail } from "@/features/purchases/queries/list-purchase-invoices";
import { formatPurchaseMoney } from "@/features/purchases/lib/labels";
import { toDateInputValue } from "@/lib/format-date";
import { formatFileSize } from "@/lib/format-file-size";
import { INVENTORY_CATEGORY_SUGGESTIONS } from "@/features/inventory/lib/labels";
import { DateInput } from "@/components/ui/date-input";
import { SearchableSelect } from "@/components/ui/searchable-select";

const fieldClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

type SupplierOption = { id: string; name: string; taxId: string | null };

type Props = {
  invoice: PurchaseInvoiceDetail;
  suppliers: SupplierOption[];
  canManage: boolean;
};

export function InvoiceReviewForm({ invoice, suppliers, canManage }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [number, setNumber] = useState(invoice.number);
  const [invoiceType, setInvoiceType] = useState(invoice.invoiceType ?? "");
  const [pointOfSale, setPointOfSale] = useState(invoice.pointOfSale ?? "");
  const [issueDate, setIssueDate] = useState(toDateInputValue(invoice.issueDate));
  const [dueDate, setDueDate] = useState(toDateInputValue(invoice.dueDate));
  const [currency, setCurrency] = useState(invoice.currency || "ARS");
  const [netAmount, setNetAmount] = useState(invoice.netAmount);
  const [taxAmount, setTaxAmount] = useState(invoice.taxAmount);
  const [otherTaxes, setOtherTaxes] = useState(invoice.otherTaxes);
  const [totalAmount, setTotalAmount] = useState(invoice.totalAmount);
  const [supplierTaxId, setSupplierTaxId] = useState(invoice.supplierTaxId ?? "");
  const [supplierName, setSupplierName] = useState(invoice.supplierName ?? "");
  const [supplierId, setSupplierId] = useState(invoice.supplierId ?? "");
  const [cae, setCae] = useState(invoice.cae ?? "");
  const [caeDueDate, setCaeDueDate] = useState(toDateInputValue(invoice.caeDueDate));
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [lines, setLines] = useState<InvoiceLineInput[]>(
    invoice.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
      unitCost: i.unitCost,
      taxPct: i.taxPct,
      totalCost: i.totalCost,
      category: i.category ?? "General",
    })),
  );

  const isConfirmed = invoice.status === "CONFIRMED";

  const linesTotal = useMemo(
    () => lines.reduce((a, l) => a + (Number(l.totalCost) || 0), 0),
    [lines],
  );

  function updateLine(index: number, patch: Partial<InvoiceLineInput>) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const next = { ...l, ...patch };
        if (patch.quantity != null || patch.unitCost != null) {
          next.totalCost =
            Math.round(
              ((Number(next.quantity) || 0) * (Number(next.unitCost) || 0) +
                Number.EPSILON) *
                100,
            ) / 100;
        }
        return next;
      }),
    );
  }

  function save(confirm: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await updatePurchaseInvoice({
        invoiceId: invoice.id,
        number,
        invoiceType,
        pointOfSale,
        issueDate,
        dueDate,
        currency,
        netAmount,
        taxAmount,
        otherTaxes,
        totalAmount,
        supplierTaxId,
        supplierName,
        supplierId: supplierId || null,
        cae,
        caeDueDate,
        notes,
        lines,
        confirm,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (!canManage) {
    return (
      <div className="space-y-4 text-sm">
        <p>
          {invoice.supplierName ?? "Proveedor"} · {invoice.supplierTaxId ?? "—"}
        </p>
        <p>
          Neto {formatPurchaseMoney(invoice.netAmount, invoice.currency)} · IVA{" "}
          {formatPurchaseMoney(invoice.taxAmount, invoice.currency)} · Total{" "}
          {formatPurchaseMoney(invoice.totalAmount, invoice.currency)}
        </p>
        <ul className="divide-y divide-border border-y border-border">
          {invoice.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-2">
              <span>{item.description}</span>
              <span className="tabular-nums">
                {formatPurchaseMoney(item.totalCost, invoice.currency)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(invoice.extractionNotes || invoice.confidencePct != null) && (
        <div className="rounded-md border border-border bg-surface/50 px-4 py-3 text-sm">
          <p className="font-medium">
            Desglose automático
            {invoice.confidencePct != null
              ? ` · confianza ${Math.round(invoice.confidencePct)}%`
              : ""}
          </p>
          {invoice.extractionNotes && (
            <p className="mt-1 text-muted-foreground">{invoice.extractionNotes}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Revisá categorías de inventario antes de confirmar: al confirmar, las
            líneas ingresan al stock de la obra.
          </p>
        </div>
      )}

      {isConfirmed && (
        <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm">
          Factura confirmada: el stock ya impactó el inventario. No se puede
          editar.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <a
          href={invoice.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline-offset-2 hover:underline"
        >
          Ver archivo ({invoice.fileName})
        </a>
        <span className="text-muted-foreground">
          {formatFileSize(invoice.fileSize)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">N° comprobante</span>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className={fieldClass}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Tipo</span>
          <select
            value={invoiceType}
            onChange={(e) => setInvoiceType(e.target.value)}
            className={fieldClass}
          >
            <option value="">—</option>
            {["A", "B", "C", "M", "E"].map((t) => (
              <option key={t} value={t}>
                Factura {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Punto de venta</span>
          <input
            value={pointOfSale}
            onChange={(e) => setPointOfSale(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Fecha emisión</span>
          <DateInput
            value={issueDate}
            onChange={setIssueDate}
            className="w-full bg-surface"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Vencimiento</span>
          <DateInput
            value={dueDate}
            onChange={setDueDate}
            className="w-full bg-surface"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Moneda</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={fieldClass}
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">CUIT proveedor</span>
          <input
            value={supplierTaxId}
            onChange={(e) => setSupplierTaxId(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">
            Razón social
          </span>
          <input
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">
            Proveedor del catálogo
          </span>
          <SearchableSelect
            value={supplierId}
            onChange={setSupplierId}
            emptyLabel="Sin vincular"
            searchPlaceholder="Buscar proveedor…"
            options={suppliers.map((s) => ({
              value: s.id,
              label: s.taxId ? `${s.name} (${s.taxId})` : s.name,
              keywords: `${s.name} ${s.taxId ?? ""}`,
            }))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">CAE</span>
          <input
            value={cae}
            onChange={(e) => setCae(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Vto. CAE</span>
          <DateInput
            value={caeDueDate}
            onChange={setCaeDueDate}
            className="w-full bg-surface"
          />
        </label>
        <label className="block text-sm sm:col-span-2 lg:col-span-3">
          <span className="mb-1 block text-muted-foreground">Notas</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={fieldClass}
          />
        </label>
      </div>

      <dl className="grid gap-3 sm:grid-cols-4">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Neto</span>
          <input
            type="number"
            step="0.01"
            value={netAmount}
            onChange={(e) => setNetAmount(Number(e.target.value))}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">IVA</span>
          <input
            type="number"
            step="0.01"
            value={taxAmount}
            onChange={(e) => setTaxAmount(Number(e.target.value))}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Otros tributos</span>
          <input
            type="number"
            step="0.01"
            value={otherTaxes}
            onChange={(e) => setOtherTaxes(Number(e.target.value))}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Total</span>
          <input
            type="number"
            step="0.01"
            value={totalAmount}
            onChange={(e) => setTotalAmount(Number(e.target.value))}
            className={fieldClass}
          />
        </label>
      </dl>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium">Líneas</h3>
          {!isConfirmed && (
            <button
              type="button"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  {
                    description: "",
                    quantity: 1,
                    unit: "u",
                    unitCost: 0,
                    taxPct: 21,
                    totalCost: 0,
                    category: "General",
                  },
                ])
              }
              className="text-sm text-accent hover:underline"
            >
              + Línea
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-2 font-medium">Descripción</th>
                <th className="py-2 pr-2 font-medium">Categoría</th>
                <th className="py-2 pr-2 text-right font-medium">Cant.</th>
                <th className="py-2 pr-2 font-medium">Un.</th>
                <th className="py-2 pr-2 text-right font-medium">P. unit.</th>
                <th className="py-2 pr-2 text-right font-medium">IVA %</th>
                <th className="py-2 pr-2 text-right font-medium">Total</th>
                <th className="py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-b border-border/70">
                  <td className="py-2 pr-2">
                    <input
                      value={line.description}
                      disabled={isConfirmed}
                      onChange={(e) =>
                        updateLine(index, { description: e.target.value })
                      }
                      className={fieldClass}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      list="inv-categories"
                      value={line.category ?? "General"}
                      disabled={isConfirmed}
                      onChange={(e) =>
                        updateLine(index, { category: e.target.value })
                      }
                      className={fieldClass}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.quantity}
                      disabled={isConfirmed}
                      onChange={(e) =>
                        updateLine(index, { quantity: Number(e.target.value) })
                      }
                      className={`${fieldClass} text-right`}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      value={line.unit}
                      disabled={isConfirmed}
                      onChange={(e) =>
                        updateLine(index, { unit: e.target.value })
                      }
                      className={fieldClass}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.unitCost}
                      disabled={isConfirmed}
                      onChange={(e) =>
                        updateLine(index, { unitCost: Number(e.target.value) })
                      }
                      className={`${fieldClass} text-right`}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.taxPct}
                      disabled={isConfirmed}
                      onChange={(e) =>
                        updateLine(index, { taxPct: Number(e.target.value) })
                      }
                      className={`${fieldClass} text-right`}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.totalCost}
                      disabled={isConfirmed}
                      onChange={(e) =>
                        updateLine(index, { totalCost: Number(e.target.value) })
                      }
                      className={`${fieldClass} text-right`}
                    />
                  </td>
                  <td className="py-2">
                    {!isConfirmed && (
                      <button
                        type="button"
                        onClick={() =>
                          setLines((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="text-xs text-danger"
                      >
                        Quitar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="inv-categories">
            {INVENTORY_CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <p className="text-sm text-muted-foreground">
          Suma de líneas:{" "}
          <span className="font-medium text-foreground">
            {formatPurchaseMoney(linesTotal, currency)}
          </span>
        </p>
      </section>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {invoice.status !== "CANCELLED" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("¿Anular esta factura?")) return;
                startTransition(async () => {
                  const result = await setPurchaseInvoiceStatus({
                    invoiceId: invoice.id,
                    status: "CANCELLED",
                  });
                  if (!result.ok) setError(result.error);
                  else router.refresh();
                });
              }}
              className="rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
            >
              Anular
            </button>
          )}
          {invoice.status === "DRAFT" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("¿Eliminar borrador?")) return;
                startTransition(async () => {
                  const result = await deletePurchaseInvoice(invoice.id);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  router.push(`/projects/${invoice.projectId}/purchases`);
                  router.refresh();
                });
              }}
              className="rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
            >
              Eliminar
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!isConfirmed && (
            <button
              type="button"
              disabled={pending}
              onClick={() => save(false)}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar borrador"}
            </button>
          )}
          {invoice.status !== "CONFIRMED" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => save(true)}
              className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              Confirmar e ingresar a inventario
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
