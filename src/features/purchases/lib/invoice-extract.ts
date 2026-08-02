/**
 * Extracción de datos de facturas argentinas (PDF texto / OCR / QR AFIP).
 */

export type ExtractedInvoiceLine = {
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  taxPct: number;
  totalCost: number;
};

export type ExtractedInvoice = {
  number: string;
  invoiceType: string | null;
  pointOfSale: string | null;
  issueDate: string | null; // YYYY-MM-DD
  dueDate: string | null;
  currency: string;
  netAmount: number;
  taxAmount: number;
  otherTaxes: number;
  totalAmount: number;
  supplierTaxId: string | null;
  supplierName: string | null;
  cae: string | null;
  caeDueDate: string | null;
  lines: ExtractedInvoiceLine[];
  confidencePct: number;
  notes: string[];
  rawText: string;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Parsea montos estilo AR: 1.234.567,89 o 1234567.89 */
export function parseArAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(/\$/g, "");
  if (!cleaned) return null;
  // 1.234.567,89
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    return round2(Number(cleaned.replace(/\./g, "").replace(",", ".")));
  }
  // 1234567,89
  if (/^\d+(,\d{1,2})$/.test(cleaned)) {
    return round2(Number(cleaned.replace(",", ".")));
  }
  // 1,234,567.89
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) {
    return round2(Number(cleaned.replace(/,/g, "")));
  }
  const n = Number(cleaned.replace(",", "."));
  return Number.isFinite(n) ? round2(n) : null;
}

export function formatCuitDigits(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length !== 11) return value.trim();
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

function parseDateToIso(raw: string): string | null {
  const m = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!m) {
    const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  }
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  let yyyy = m[3];
  if (yyyy.length === 2) yyyy = `20${yyyy}`;
  return `${yyyy}-${mm}-${dd}`;
}

function findAmountNear(text: string, labels: RegExp[]): number | null {
  for (const label of labels) {
    const re = new RegExp(
      `${label.source}[^\\n]{0,50}?\\$?\\s*([\\d.\\s,]{3,24})`,
      "i",
    );
    const m = text.match(re);
    if (m?.[1]) {
      const amount = parseArAmount(m[1].trim());
      if (amount != null && amount >= 0) return amount;
    }
  }
  return null;
}

function extractAfipQrPayload(text: string): Record<string, unknown> | null {
  const urlMatch = text.match(
    /https?:\/\/www\.afip\.gob\.ar\/fe\/qr\/\?p=([A-Za-z0-9+/=_-]+)/i,
  );
  if (!urlMatch?.[1]) return null;
  try {
    const json = Buffer.from(urlMatch[1], "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const TIPO_CMP: Record<number, string> = {
  1: "A",
  6: "B",
  11: "C",
  51: "M",
  201: "E",
};

const UNIT_ALIASES: Record<string, string> = {
  unid: "u",
  un: "u",
  u: "u",
  unidad: "u",
  unidades: "u",
  kg: "kg",
  m2: "m2",
  m3: "m3",
  "m³": "m3",
  ml: "ml",
  gl: "gl",
  pallet: "u",
};

function normalizeUnit(raw: string): string {
  const key = raw.toLowerCase().replace(/\.$/, "");
  return UNIT_ALIASES[key] ?? key.slice(0, 6);
}

/**
 * Líneas de detalle estilo AFIP:
 * CÓDIGO descripción... cantidad unidad p.unit. [%bonif] [imp.bonif] subtotal alícuota%
 * La descripción puede partirse en dos renglones.
 */
export function extractLinesFromText(text: string): ExtractedInvoiceLine[] {
  const lines: ExtractedInvoiceLine[] = [];
  const normalized = text.replace(/\r/g, "\n");

  const tableStart = normalized.search(
    /C[oó]digo\s+Producto|Producto\s*\/\s*Servicio|\nC[oó]digo\b/i,
  );
  const tableEndCandidates = [
    normalized.search(/\n\s*Observaciones\s*:/i),
    normalized.search(/\n\s*Importe\s+Neto/i),
    normalized.search(/\n\s*Subtotal\s*:/i),
  ].filter((i) => i >= 0);
  const tableEnd =
    tableEndCandidates.length > 0 ? Math.min(...tableEndCandidates) : -1;

  const body =
    tableStart >= 0
      ? normalized.slice(
          tableStart,
          tableEnd > tableStart ? tableEnd : undefined,
        )
      : normalized;

  // Une cortes de descripción ("... -\nBolsa") sin pegar el siguiente código
  const compact = body
    .replace(/-\s*\n\s*/g, "- ")
    .replace(/\n(?!\s*[A-ZÁÉÍÓÚÑ]{2,8}-\d{2,5}\b)/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

  const codeRe = /([A-ZÁÉÍÓÚÑ]{2,8}-\d{2,5})\b/gi;
  const codeHits: Array<{ code: string; index: number }> = [];
  let cm: RegExpExecArray | null;
  while ((cm = codeRe.exec(compact)) !== null) {
    codeHits.push({ code: cm[1], index: cm.index });
  }

  for (let i = 0; i < codeHits.length && lines.length < 60; i++) {
    const { code, index } = codeHits[i];
    const end =
      i + 1 < codeHits.length ? codeHits[i + 1].index : compact.length;
    const block = compact.slice(index, end).trim();
    const parsed = parseProductBlock(block, code);
    if (parsed) lines.push(parsed);
  }

  if (lines.length > 0) return lines;

  // Fallback: filas simples descripción + cant + precios
  const simpleRe =
    /^(.{5,100}?)\s+(\d+[.,]?\d*)\s+(?:u|un|unid|kg|m2|m3|m³|ml|gl)?\s*\$?\s*([\d.,]+)\s+\$?\s*([\d.,]+)\s*$/gim;
  let m: RegExpExecArray | null;
  while ((m = simpleRe.exec(normalized)) !== null && lines.length < 40) {
    const qty = parseArAmount(m[2]) ?? Number(m[2].replace(",", "."));
    const unitCost = parseArAmount(m[3]);
    const totalCost = parseArAmount(m[4]);
    if (!unitCost || !totalCost || !Number.isFinite(qty) || qty <= 0) continue;
    const desc = m[1].replace(/\s+/g, " ").trim();
    if (desc.length < 3) continue;
    if (/total|subtotal|iva|neto|importe|c[oó]digo|producto/i.test(desc)) {
      continue;
    }
    lines.push({
      description: desc,
      quantity: qty,
      unit: "u",
      unitCost,
      taxPct: 21,
      totalCost,
    });
  }

  return lines;
}

/** Parsea un bloque que empieza con código de artículo. */
function parseProductBlock(
  block: string,
  code: string,
): ExtractedInvoiceLine | null {
  const unitRe =
    /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s+(unid(?:ades)?|u\.?|kg|m2|m3|m³|ml|gl|pallet)\b\s+/gi;
  const candidates: Array<{
    qtyRaw: string;
    unitRaw: string;
    index: number;
    end: number;
  }> = [];
  let um: RegExpExecArray | null;
  while ((um = unitRe.exec(block)) !== null) {
    candidates.push({
      qtyRaw: um[1],
      unitRaw: um[2],
      index: um.index,
      end: um.index + um[0].length,
    });
  }
  if (candidates.length === 0) return null;

  // Preferir el último "cantidad + unidad" (el de la tabla, no el de la descripción)
  // y unidades comerciales (unid/m3) sobre "kg" embebido en el texto.
  const ranked = [...candidates].sort((a, b) => {
    const score = (c: (typeof candidates)[number]) => {
      const u = c.unitRaw.toLowerCase();
      let s = c.index;
      if (/^unid|^u\.?$|^m3$|^m³$|^pallet$/.test(u)) s += 10_000;
      if (/,/.test(c.qtyRaw) || /\.\d{3}/.test(c.qtyRaw)) s += 5_000;
      return s;
    };
    return score(b) - score(a);
  });

  for (const cand of ranked) {
    const quantity = parseArAmount(cand.qtyRaw);
    if (quantity == null || quantity <= 0) continue;
    const unit = normalizeUnit(cand.unitRaw);
    const afterUnit = block.slice(cand.end);
    const desc = block
      .slice(0, cand.index)
      .replace(new RegExp(`^${code}\\s*`, "i"), "")
      .replace(/\s+/g, " ")
      .trim();

    const amountTokens = [
      ...afterUnit.matchAll(
        /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+,\d{1,2}|\d{1,2}(?=\s*%))/g,
      ),
    ].map((x) => x[1]);
    if (amountTokens.length < 2) continue;

    let taxPct = 21;
    const last = amountTokens[amountTokens.length - 1];
    const lastNum = parseArAmount(last) ?? Number(last.replace(",", "."));
    if (Number.isFinite(lastNum) && lastNum > 0 && lastNum <= 105) {
      taxPct = lastNum;
      amountTokens.pop();
    }
    if (amountTokens.length === 0) continue;

    const totalCost = parseArAmount(amountTokens[amountTokens.length - 1]);
    const unitCost = parseArAmount(amountTokens[0]);
    if (
      totalCost == null ||
      unitCost == null ||
      totalCost <= 0 ||
      unitCost < 0
    ) {
      continue;
    }

    // Coherencia: subtotal ≈ cant × p.unit (tolerancia por bonificaciones)
    const expected = quantity * unitCost;
    if (expected > 0 && totalCost > expected * 1.05) continue;

    const description = `${code} ${desc}`.replace(/\s+/g, " ").trim();
    if (description.length < 5) continue;
    if (/total|subtotal|importe\s+neto|observaciones/i.test(description)) {
      continue;
    }

    return {
      description: description.slice(0, 240),
      quantity,
      unit,
      unitCost,
      taxPct,
      totalCost,
    };
  }

  return null;
}

function extractSupplierName(text: string): string | null {
  // Preferir "Razón Social:" del emisor (no "Apellido y Nombre / Razón Social" del receptor)
  const labeled = text.match(
    /(?:^|\n)\s*Raz[oó]n\s+Social\s*[:=]\s*([^\n]{3,100})(?:\n([^\n]{2,80}))?/i,
  );
  if (labeled) {
    let name = labeled[1].trim();
    const next = labeled[2]?.trim() ?? "";
    if (
      next &&
      !/^(Domicilio|CUIT|Condici[oó]n|Fecha|Punto|Comp\.?|FACTURA|Ingresos)/i.test(
        next,
      ) &&
      (/S\.?\s*A\.?|S\.?\s*R\.?\s*L\.?|S\.?\s*A\.?\s*S\.?|S\.?\s*H\.?/i.test(
        next,
      ) ||
        /^[A-ZÁÉÍÓÚÑ0-9 .,&'"-]{2,60}$/.test(next))
    ) {
      name = `${name} ${next}`.replace(/\s+/g, " ").trim();
    }
    return name.slice(0, 160);
  }

  // Primeras líneas del documento (antes de FACTURA / CUIT) suelen ser el emisor
  const head = text.split(/\n/).slice(0, 6).map((l) => l.trim()).filter(Boolean);
  const joined: string[] = [];
  for (const line of head) {
    if (/FACTURA|CUIT|Punto de Venta|Comp\.?\s*N/i.test(line)) break;
    if (/Raz[oó]n\s+Social/i.test(line)) continue;
    joined.push(line);
    if (joined.join(" ").length > 20) break;
  }
  if (joined.length > 0) {
    return joined.join(" ").replace(/\s+/g, " ").trim().slice(0, 160);
  }
  return null;
}

function extractPointOfSale(text: string): string | null {
  const m = text.match(
    /Punto\s+de\s+Venta\s*[:=]?\s*(\d{1,5})/i,
  );
  return m ? m[1].padStart(5, "0") : null;
}

function extractCompNumber(text: string): string | null {
  const patterns = [
    /Comp\.?\s*N(?:ro|um(?:ero)?)?\.?\s*[:=]?\s*(\d{1,8})/i,
    /Comprobante\s*N[°ºo.]?\s*[:=]?\s*(\d{1,8})/i,
    /N[°ºo.]\s*(?:de\s+)?(?:Comp(?:robante)?|Factura)\s*[:=]?\s*(\d{1,8})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].padStart(8, "0");
  }
  return null;
}

function extractInvoiceType(text: string): string | null {
  const letter = text.match(/Factura\s*([ABCEM])\b/i);
  if (letter) return letter[1].toUpperCase();

  // Layout AFIP: "A" + "COD. 001" a veces llega como "ACOD. 001"
  const cod = text.match(
    /(?:^|\n|\s)([ABCEM])\s*COD\.?\s*0*([0-9]{1,3})\b|(?:^|\n)\s*COD\.?\s*0*([0-9]{1,3})\b/i,
  );
  if (cod) {
    if (cod[1]) return cod[1].toUpperCase();
    const n = Number(cod[2] || cod[3]);
    if (n === 1) return "A";
    if (n === 6) return "B";
    if (n === 11) return "C";
    if (n === 51) return "M";
  }

  const aCod = text.match(/\bA\s*COD\.?\s*0*1\b|ACOD\.?\s*0*1\b/i);
  if (aCod) return "A";

  return null;
}

function extractCae(text: string): string | null {
  const patterns = [
    /\bCAE\s*N[°ºo.]?\s*[:=]?\s*(\d{10,16})\b/i,
    /\bCAE\b\s*[:=]?\s*(\d{10,16})\b/i,
    /C[oó]digo\s+de\s+Autorizaci[oó]n\s*(?:Electr[oó]nic[oa])?\s*[:=]?\s*(\d{10,16})\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function extractCaeDueDate(text: string): string | null {
  const patterns = [
    /Fecha\s+de\s+Vencimiento\s+de\s+CAE\s*[:=]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    /(?:Vto\.?\s*CAE|CAE\s*Vto\.?)\s*[:=]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    /Vencimiento\s+(?:del\s+)?CAE\s*[:=]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return parseDateToIso(m[1]);
  }
  return null;
}

export function parseArgentineInvoiceText(rawText: string): ExtractedInvoice {
  const text = rawText.replace(/\r/g, "\n");
  const notes: string[] = [];
  let confidence = 25;

  const qr = extractAfipQrPayload(text);
  let invoiceType: string | null = null;
  let pointOfSale: string | null = null;
  let number = "";
  let issueDate: string | null = null;
  let currency = "ARS";
  let totalAmount = 0;
  let netAmount = 0;
  let taxAmount = 0;
  let otherTaxes = 0;
  let supplierTaxId: string | null = null;
  let supplierName: string | null = null;
  let cae: string | null = null;
  let caeDueDate: string | null = null;

  if (qr) {
    notes.push("Datos leídos desde QR AFIP");
    confidence += 40;
    if (typeof qr.cuit === "number" || typeof qr.cuit === "string") {
      supplierTaxId = formatCuitDigits(String(qr.cuit));
    }
    if (typeof qr.ptoVta === "number") {
      pointOfSale = String(qr.ptoVta).padStart(5, "0");
    }
    if (typeof qr.nroCmp === "number") {
      const nro = String(qr.nroCmp).padStart(8, "0");
      number = pointOfSale ? `${pointOfSale}-${nro}` : nro;
    }
    if (typeof qr.tipoCmp === "number") {
      invoiceType = TIPO_CMP[qr.tipoCmp] ?? String(qr.tipoCmp);
    }
    if (typeof qr.fecha === "string") {
      issueDate = parseDateToIso(qr.fecha) ?? qr.fecha;
    }
    if (typeof qr.importe === "number") {
      totalAmount = round2(qr.importe);
    }
    if (qr.moneda === "DOL") currency = "USD";
    if (typeof qr.codAut === "number" || typeof qr.codAut === "string") {
      cae = String(qr.codAut);
    }
  }

  // CUIT emisor: preferir el asociado al bloque del encabezado / primero del doc
  if (!supplierTaxId) {
    const cuits = [...text.matchAll(/\b(\d{2}[-\s]?\d{8}[-\s]?\d)\b/g)].map(
      (x) => formatCuitDigits(x[1]),
    );
    if (cuits[0]) {
      supplierTaxId = cuits[0];
      confidence += 10;
      notes.push("CUIT detectado por patrón");
    }
  }

  if (!pointOfSale) {
    pointOfSale = extractPointOfSale(text);
    if (pointOfSale) confidence += 8;
  }

  if (!number) {
    const factura = text.match(
      /Factura\s*([ABCEM])\s*(?:N[°ºo.]?\s*)?(\d{4,5})\s*[-–]?\s*(\d{1,8})/i,
    );
    if (factura) {
      invoiceType = invoiceType ?? factura[1].toUpperCase();
      pointOfSale = pointOfSale ?? factura[2].padStart(5, "0");
      number = `${pointOfSale}-${factura[3].padStart(8, "0")}`;
      confidence += 15;
      notes.push("Número de factura detectado");
    } else {
      const nro = extractCompNumber(text);
      if (nro) {
        number = pointOfSale ? `${pointOfSale}-${nro}` : nro;
        confidence += 15;
        notes.push("Número de comprobante detectado");
      }
    }
  }

  if (!invoiceType) {
    invoiceType = extractInvoiceType(text);
    if (invoiceType) confidence += 5;
  }

  if (!issueDate) {
    const fecha = text.match(
      /Fecha(?:\s+de)?(?:\s+emisi[oó]n)?\s*[:=]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    );
    if (fecha) {
      issueDate = parseDateToIso(fecha[1]);
      confidence += 8;
    }
  }

  const due =
    text.match(
      /Fecha\s+de\s+Vto\.?\s+para\s+el\s+Pago\s*[:=]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    ) ??
    text.match(
      /(?:Vencimiento|Fecha\s+de\s+venc(?:imiento)?)\s*[:=]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    );
  const dueDate = due ? parseDateToIso(due[1]) : null;

  if (!totalAmount) {
    totalAmount =
      findAmountNear(text, [
        /importe\s+total/,
        /total\s+a\s+pagar/,
        /total\s+factura/,
        /\btotal\b/,
      ]) ?? 0;
    if (totalAmount) {
      confidence += 12;
      notes.push("Total detectado");
    }
  }

  netAmount =
    findAmountNear(text, [
      /importe\s+neto\s+gravado/,
      /neto\s+gravado/,
      /importe\s+neto/,
      /subtotal/,
      /\bneto\b/,
    ]) ?? 0;

  taxAmount =
    findAmountNear(text, [
      /iva\s*21\s*%/,
      /i\.?\s*v\.?\s*a\.?\s*21/,
      /\biva\b/,
    ]) ?? 0;

  otherTaxes =
    findAmountNear(text, [
      /Percepci[oó]n(?:es)?(?:\s+IIBB)?/,
      /percepciones?/,
      /otros\s+tributos/,
      /\bIIBB\b/,
    ]) ?? 0;

  if (!netAmount && totalAmount && taxAmount) {
    netAmount = round2(totalAmount - taxAmount - otherTaxes);
  } else if (!netAmount && totalAmount && !taxAmount) {
    netAmount = round2(totalAmount / 1.21);
    taxAmount = round2(totalAmount - netAmount);
    notes.push("Neto/IVA estimados desde total (IVA 21%)");
    confidence += 5;
  } else if (netAmount && !taxAmount && totalAmount) {
    taxAmount = round2(totalAmount - netAmount - otherTaxes);
  } else if (netAmount && taxAmount && !totalAmount) {
    totalAmount = round2(netAmount + taxAmount + otherTaxes);
  }

  if (!cae) {
    cae = extractCae(text);
    if (cae) confidence += 10;
  }
  caeDueDate = extractCaeDueDate(text) ?? caeDueDate;

  if (!supplierName) {
    supplierName = extractSupplierName(text);
    if (supplierName) confidence += 10;
  }

  let lines = extractLinesFromText(text);
  if (lines.length > 0) {
    confidence += Math.min(25, lines.length * 4);
    notes.push(`${lines.length} línea(s) de detalle detectadas`);
  } else if (totalAmount > 0) {
    lines = [
      {
        description: "Concepto de factura (desglose automático)",
        quantity: 1,
        unit: "u",
        unitCost: netAmount || totalAmount,
        taxPct:
          taxAmount && netAmount ? round2((taxAmount / netAmount) * 100) : 21,
        totalCost: netAmount || totalAmount,
      },
    ];
    notes.push("Se generó una línea única a partir del total");
  }

  if (!number) {
    number = `TEMP-${Date.now().toString().slice(-8)}`;
    notes.push("Número no detectado: se asignó temporal");
    confidence = Math.max(10, confidence - 15);
  }

  return {
    number,
    invoiceType,
    pointOfSale,
    issueDate,
    dueDate,
    currency,
    netAmount: round2(netAmount),
    taxAmount: round2(taxAmount),
    otherTaxes: round2(otherTaxes),
    totalAmount: round2(totalAmount),
    supplierTaxId,
    supplierName,
    cae,
    caeDueDate,
    lines,
    confidencePct: Math.min(98, Math.max(5, confidence)),
    notes,
    rawText: text.slice(0, 50_000),
  };
}

export async function extractTextFromInvoiceFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<{ text: string; method: string }> {
  const lower = fileName.toLowerCase();
  const isPdf =
    mimeType === "application/pdf" || lower.endsWith(".pdf");
  const isImage =
    mimeType.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif)$/i.test(lower);

  if (isPdf) {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      const text = (result.text || "").trim();
      if (text.length > 40) {
        return { text, method: "pdf-text" };
      }
    } catch (error) {
      console.error("pdf-parse", error);
    }
  }

  if (isImage || isPdf) {
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("spa");
      const {
        data: { text },
      } = await worker.recognize(buffer);
      await worker.terminate();
      if (text?.trim()) {
        return { text: text.trim(), method: "ocr-tesseract" };
      }
    } catch (error) {
      console.error("tesseract", error);
    }
  }

  return { text: "", method: "none" };
}

export async function extractInvoiceFromFile(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<ExtractedInvoice> {
  const { text, method } = await extractTextFromInvoiceFile(
    input.buffer,
    input.mimeType,
    input.fileName,
  );

  if (!text) {
    return {
      number: `TEMP-${Date.now().toString().slice(-8)}`,
      invoiceType: null,
      pointOfSale: null,
      issueDate: null,
      dueDate: null,
      currency: "ARS",
      netAmount: 0,
      taxAmount: 0,
      otherTaxes: 0,
      totalAmount: 0,
      supplierTaxId: null,
      supplierName: null,
      cae: null,
      caeDueDate: null,
      lines: [],
      confidencePct: 0,
      notes: [
        "No se pudo leer texto del archivo. Completá los datos manualmente.",
      ],
      rawText: "",
    };
  }

  const parsed = parseArgentineInvoiceText(text);
  parsed.notes = [`Método: ${method}`, ...parsed.notes];
  if (method === "ocr-tesseract") {
    parsed.confidencePct = Math.max(5, parsed.confidencePct - 10);
  }
  return parsed;
}
