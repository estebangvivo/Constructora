export type ArcaPersona = {
  taxId: string;
  name: string;
  personType: "FISICA" | "JURIDICA" | "UNKNOWN";
  address: string | null;
  state: string | null;
  postalCode: string | null;
  /** Si vino de DNI, puede haber varios CUITs candidatos */
  candidates?: { taxId: string; name: string }[];
  source: "arca" | "afipsdk" | "indicadores" | "mock";
};

export type ArcaLookupResult =
  | { ok: true; persona: ArcaPersona }
  | {
      ok: false;
      error: string;
      code?: "NOT_CONFIGURED" | "NOT_FOUND" | "INVALID" | "UPSTREAM";
    };
