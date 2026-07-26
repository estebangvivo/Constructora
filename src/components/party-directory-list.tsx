"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Search, Truck } from "lucide-react";
import { formatMoney } from "@/features/treasury/lib/labels";

export type PartyDirectoryItem = {
  id: string;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  isActive: boolean;
  projectCount: number;
  balance: number;
  currency: string;
};

type SortKey = "name-asc" | "name-desc" | "balance-desc" | "balance-asc";

type PartyDirectoryListProps = {
  kind: "client" | "supplier";
  items: PartyDirectoryItem[];
  emptyMessage: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function matchesQuery(item: PartyDirectoryItem, query: string) {
  if (!query.trim()) return true;
  const q = normalize(query.trim());
  const haystack = normalize(
    [item.name, item.taxId, item.contactName, item.email, item.phone]
      .filter(Boolean)
      .join(" "),
  );
  return haystack.includes(q);
}

export function PartyDirectoryList({
  kind,
  items,
  emptyMessage,
}: PartyDirectoryListProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const accountHref =
    kind === "client"
      ? (id: string) => `/treasury/accounts/clients/${id}`
      : (id: string) => `/treasury/accounts/suppliers/${id}`;
  const Icon = kind === "client" ? Building2 : Truck;

  const filtered = useMemo(() => {
    const rows = items.filter((item) => matchesQuery(item, query));
    rows.sort((a, b) => {
      switch (sort) {
        case "name-desc":
          return b.name.localeCompare(a.name, "es", { sensitivity: "base" });
        case "balance-desc":
          return b.balance - a.balance || a.name.localeCompare(b.name, "es");
        case "balance-asc":
          return a.balance - b.balance || a.name.localeCompare(b.name, "es");
        case "name-asc":
        default:
          return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
      }
    });
    return rows;
  }, [items, query, sort]);

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-surface/50 px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Buscar</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              kind === "client"
                ? "Buscar cliente, CUIT, contacto…"
                : "Buscar proveedor, CUIT, contacto…"
            }
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none ring-accent focus:ring-2"
          />
        </label>
        <label className="block shrink-0 text-sm sm:w-56">
          <span className="sr-only">Ordenar</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-accent focus:ring-2"
          >
            <option value="name-asc">Nombre A–Z</option>
            <option value="name-desc">Nombre Z–A</option>
            <option value="balance-desc">Saldo mayor a menor</option>
            <option value="balance-asc">Saldo menor a mayor</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No hay resultados para “{query.trim()}”.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {filtered.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-accent">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-medium">
                    <Link
                      href={accountHref(item.id)}
                      className="hover:text-accent hover:underline"
                    >
                      {item.name}
                    </Link>
                    {!item.isActive && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (inactivo)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[item.taxId, item.contactName, item.email, item.phone]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos de contacto"}
                  </p>
                </div>
              </div>
              <div className="sm:text-right">
                <Link
                  href={accountHref(item.id)}
                  className="block tabular-nums hover:underline"
                >
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Cuenta corriente
                  </span>
                  <span
                    className={`mt-0.5 block font-medium ${
                      Math.abs(item.balance) < 0.009
                        ? "text-muted-foreground"
                        : item.balance > 0
                          ? "text-foreground"
                          : "text-success"
                    }`}
                  >
                    {formatMoney(item.balance, item.currency)}
                  </span>
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.projectCount} obra
                  {item.projectCount === 1 ? "" : "s"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
