"use client";

import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import {
  getArcaStatusAction,
  lookupTaxEntityAction,
} from "@/features/arca/actions/lookup-tax-entity";
import { formatCuit } from "@/lib/arca/tax-id";
import type { ArcaPersona } from "@/lib/arca/types";

export type PartyFormValues = {
  taxId: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
};

type TaxIdLookupFieldsProps = {
  values: PartyFormValues;
  onChange: (patch: Partial<PartyFormValues>) => void;
};

export function TaxIdLookupFields({ values, onChange }: TaxIdLookupFieldsProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"ok" | "warn" | "error">("ok");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [hasIndicadores, setHasIndicadores] = useState(false);
  const [candidates, setCandidates] = useState<
    { taxId: string; name: string }[] | null
  >(null);

  useEffect(() => {
    getArcaStatusAction()
      .then((s) => {
        setConfigured(s.configured);
        setHasIndicadores(s.providers.indicadores);
      })
      .catch(() => setConfigured(false));
  }, []);

  function applyPersona(persona: ArcaPersona) {
    onChange({
      taxId: persona.taxId,
      name: persona.name,
      address: persona.address ?? values.address,
      contactName:
        persona.personType === "FISICA" && !values.contactName
          ? persona.name
          : values.contactName,
    });
  }

  function onLookup() {
    setMessage(null);
    setCandidates(null);
    startTransition(async () => {
      const result = await lookupTaxEntityAction(values.taxId);
      if (!result.ok) {
        setMessageTone(result.code === "NOT_CONFIGURED" ? "warn" : "error");
        setMessage(result.error);
        return;
      }

      if (result.persona.candidates && result.persona.candidates.length > 1) {
        setCandidates(result.persona.candidates);
        setMessageTone("warn");
        setMessage(
          "Hay varios CUIT/CUIL posibles. Elegí uno para completar los datos.",
        );
        return;
      }

      applyPersona(result.persona);
      setMessageTone("ok");
      const source =
        result.persona.source === "indicadores"
          ? "Indicadores.ar"
          : "ARCA / Afip SDK";
      setMessage(`Datos completados desde ${source}. Revisá y guardá.`);
    });
  }

  function onPickCandidate(taxId: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await lookupTaxEntityAction(taxId);
      if (!result.ok) {
        setMessageTone("error");
        setMessage(result.error);
        return;
      }
      applyPersona(result.persona);
      setCandidates(null);
      setMessageTone("ok");
      setMessage("Datos completados. Revisá y guardá.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-dashed border-border bg-surface/60 p-3">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">
            CUIT / CUIL / DNI
          </span>
          <div className="flex gap-2">
            <input
              value={values.taxId}
              onChange={(e) => onChange({ taxId: e.target.value })}
              onBlur={() => {
                const digits = values.taxId.replace(/\D/g, "");
                if (digits.length === 11) {
                  onChange({ taxId: formatCuit(digits) });
                }
              }}
              placeholder="20-12345678-9 o DNI"
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
            />
            <button
              type="button"
              onClick={onLookup}
              disabled={pending || !values.taxId.trim()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              <Search className="size-4" aria-hidden />
              {pending ? "Buscando…" : "Buscar"}
            </button>
          </div>
        </label>

        {configured === false && (
          <p className="mt-2 text-xs text-warning">
            Para buscar sin certificado ARCA, creá una API key gratis en{" "}
            <a
              href="https://indicadores.ar/api-empresas"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              indicadores.ar
            </a>
            , agregala como <code>INDICADORES_API_KEY</code> en <code>.env</code>{" "}
            y reiniciá el servidor.
          </p>
        )}

        {configured && !hasIndicadores && (
          <p className="mt-2 text-xs text-muted-foreground">
            Usando Afip SDK. Para datos reales sin certificado, agregá{" "}
            <code>INDICADORES_API_KEY</code>.
          </p>
        )}

        {message && configured !== false && (
          <p
            className={
              messageTone === "ok"
                ? "mt-2 text-xs text-success"
                : messageTone === "warn"
                  ? "mt-2 text-xs text-warning"
                  : "mt-2 text-xs text-danger"
            }
            role="status"
          >
            {message}
          </p>
        )}

        {candidates && candidates.length > 0 && (
          <ul className="mt-2 space-y-1">
            {candidates.map((c) => (
              <li key={c.taxId}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onPickCandidate(c.taxId)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-sm hover:border-accent/40"
                >
                  <span className="font-medium">{c.taxId}</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {c.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Field
        label="Nombre / Razón social"
        value={values.name}
        onChange={(name) => onChange({ name })}
        required
      />
      <Field
        label="Contacto"
        value={values.contactName}
        onChange={(contactName) => onChange({ contactName })}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Email"
          type="email"
          value={values.email}
          onChange={(email) => onChange({ email })}
        />
        <Field
          label="Teléfono"
          value={values.phone}
          onChange={(phone) => onChange({ phone })}
        />
      </div>
      <Field
        label="Domicilio"
        value={values.address}
        onChange={(address) => onChange({ address })}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-accent focus:ring-2"
      />
    </label>
  );
}
