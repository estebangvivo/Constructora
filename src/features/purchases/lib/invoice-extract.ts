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
      `${label.source}\\s*[:=]?\\s*\\$?\\s*([\\d.\\s,]{3,20})`,
      "i",
    );
    const m = text.match(re);
    if (m?.[1]) {
      const amount = parseArAmount(m[1].trim());
      if (amount != null && amount > 0) return amount;
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

function extractLinesFromText(text: string): ExtractedInvoiceLine[] {
  const lines: ExtractedInvoiceLine[] = [];
  const rowRe =
    /^(.{8,80}?)\s+(\d+[.,]?\d*)\s+(?:u|un|kg|m2|m³|ml|gl)?\s*\$?\s*([\d.,]+)\s+\$?\s*([\d.,]+)\s*$/gim;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(text)) !== null && lines.length < 40) {
    const qty = parseArAmount(m[2]) ?? Number(m[2].replace(",", "."));
    const unitCost = parseArAmount(m[3]);
    const totalCost = parseArAmount(m[4]);
    if (!unitCost || !totalCost || !Number.isFinite(qty) || qty <= 0) continue;
    const desc = m[1].replace(/\s+/g, " ").trim();
    if (desc.length < 3) continue;
    if (/total|subtotal|iva|neto|importe/i.test(desc)) continue;
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

  // CUIT emisor (primer CUIT del documento suele ser el emisor en facturas)
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

  // Tipo + número
  if (!number) {
    const factura = text.match(
      /Factura\s*([ABCEM])\s*(?:N[°ºo.]?\s*)?(\d{4,5})\s*[-–]?\s*(\d{1,8})/i,
    );
    if (factura) {
      invoiceType = factura[1].toUpperCase();
      pointOfSale = factura[2].padStart(5, "0");
      number = `${pointOfSale}-${factura[3].padStart(8, "0")}`;
      confidence += 15;
      notes.push("Número de factura detectado");
    } else {
      const alt = text.match(
        /(?:Comp\.?|Comprobante)\s*N[°ºo.]?\s*(\d{4,5})\s*[-–]\s*(\d{1,8})/i,
      );
      if (alt) {
        pointOfSale = alt[1].padStart(5, "0");
        number = `${pointOfSale}-${alt[2].padStart(8, "0")}`;
        confidence += 10;
      }
    }
  }

  if (!invoiceType) {
    const t = text.match(/Factura\s*([ABCEM])\b/i);
    if (t) invoiceType = t[1].toUpperCase();
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

  const due = text.match(
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
      /neto\s+gravado/,
      /importe\s+neto/,
      /subtotal/,
      /neto/,
    ]) ?? 0;

  taxAmount =
    findAmountNear(text, [
      /iva\s*21\s*%/,
      /i\.?\s*v\.?\s*a\.?\s*21/,
      /\biva\b/,
    ]) ?? 0;

  otherTaxes =
    findAmountNear(text, [
      /percepciones?/,
      /otros\s+tributos/,
      /iibb/,
    ]) ?? 0;

  if (!netAmount && totalAmount && taxAmount) {
    netAmount = round2(totalAmount - taxAmount - otherTaxes);
  } else if (!netAmount && totalAmount && !taxAmount) {
    // asumir IVA 21 incluido
    netAmount = round2(totalAmount / 1.21);
    taxAmount = round2(totalAmount - netAmount);
    notes.push("Neto/IVA estimados desde total (IVA 21%)");
    confidence += 5;
  } else if (netAmount && !taxAmount && totalAmount) {
    taxAmount = round2(totalAmount - netAmount - otherTaxes);
  } else if (netAmount && taxAmount && !totalAmount) {
    totalAmount = round2(netAmount + taxAmount + otherTaxes);
  }

  const caeMatch = text.match(/\bCAE\b\s*[:=]?\s*(\d{10,14})\b/i);
  if (!cae && caeMatch) {
    cae = caeMatch[1];
    confidence += 8;
  }
  const caeVto = text.match(
    /(?:Vto\.?\s*CAE|CAE\s*Vto\.?)\s*[:=]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
  );
  if (caeVto) caeDueDate = parseDateToIso(caeVto[1]);

  // Razón social: línea cercana a CUIT o "Razón Social"
  const rs = text.match(
    /(?:Raz[oó]n\s+Social|Apellido\s+y\s+Nombre)\s*[:=]?\s*([^\n]{3,80})/i,
  );
  if (rs) {
    supplierName = rs[1].trim().replace(/\s+/g, " ");
    confidence += 8;
  }

  let lines = extractLinesFromText(text);
  if (lines.length === 0 && totalAmount > 0) {
    lines = [
      {
        description: "Concepto de factura (desglose automático)",
        quantity: 1,
        unit: "u",
        unitCost: netAmount || totalAmount,
        taxPct: taxAmount && netAmount ? round2((taxAmount / netAmount) * 100) : 21,
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
