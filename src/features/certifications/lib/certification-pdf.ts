import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  CERT_STATUS_LABEL,
  formatCertMoney,
} from "@/features/certifications/lib/labels";
import { formatDateAR } from "@/lib/format-date";
import type { CertificationStatus } from "@prisma/client";

export type CertificationPdfItem = {
  code: string;
  description: string;
  previousPct: number;
  currentPct: number;
  periodPct: number;
  amount: number;
};

export type CertificationPdfInput = {
  number: string;
  status: CertificationStatus;
  periodStart: Date | string;
  periodEnd: Date | string;
  currency: string;
  grossAmount: number;
  retentionPct: number;
  retentionAmount: number;
  netAmount: number;
  collectedAmount: number;
  notes?: string | null;
  projectCode: string;
  projectName: string;
  projectAddress?: string | null;
  clientName?: string | null;
  clientTaxId?: string | null;
  organizationName: string;
  organizationTaxId?: string | null;
  organizationAddress?: string | null;
  organizationLogo?: {
    bytes: Uint8Array;
    format: "png" | "jpg";
  } | null;
  items: CertificationPdfItem[];
};

const MARGIN = 48;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function winAnsi(text: string): string {
  return text
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x00-\xFF]/g, "?");
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = winAnsi(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawWrapped(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    font: PDFFont;
    size: number;
    maxWidth: number;
    color?: ReturnType<typeof rgb>;
    lineHeight?: number;
  },
): number {
  const {
    x,
    y,
    font,
    size,
    maxWidth,
    color = rgb(0.11, 0.1, 0.09),
    lineHeight = size * 1.35,
  } = opts;
  const lines = wrapText(text, font, size, maxWidth);
  let cursor = y;
  for (const line of lines) {
    page.drawText(winAnsi(line), { x, y: cursor, size, font, color });
    cursor -= lineHeight;
  }
  return cursor;
}

function pct(n: number) {
  return `${n.toLocaleString("es-AR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}%`;
}

export async function buildCertificationPdf(
  input: CertificationPdfInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  if (input.organizationLogo) {
    try {
      const img =
        input.organizationLogo.format === "png"
          ? await pdf.embedPng(input.organizationLogo.bytes)
          : await pdf.embedJpg(input.organizationLogo.bytes);
      const maxH = 42;
      const maxW = 120;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, {
        x: MARGIN,
        y: y - h,
        width: w,
        height: h,
      });
      y -= h + 8;
    } catch {
      /* logo opcional */
    }
  }

  page.drawText(winAnsi(input.organizationName), {
    x: MARGIN,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.11, 0.1, 0.09),
  });
  y -= 16;
  if (input.organizationTaxId) {
    page.drawText(winAnsi(`CUIT: ${input.organizationTaxId}`), {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: rgb(0.47, 0.44, 0.42),
    });
    y -= 12;
  }
  if (input.organizationAddress) {
    y = drawWrapped(page, input.organizationAddress, {
      x: MARGIN,
      y,
      font,
      size: 9,
      maxWidth: CONTENT_WIDTH,
      color: rgb(0.47, 0.44, 0.42),
    });
    y -= 4;
  }

  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0.84, 0.83, 0.82),
  });
  y -= 22;

  page.drawText("Certificacion de obra", {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.47, 0.44, 0.42),
  });
  y -= 18;
  page.drawText(winAnsi(input.number), {
    x: MARGIN,
    y,
    size: 18,
    font: fontBold,
  });
  const statusLabel = CERT_STATUS_LABEL[input.status];
  const statusWidth = font.widthOfTextAtSize(winAnsi(statusLabel), 10);
  page.drawText(winAnsi(statusLabel), {
    x: PAGE_WIDTH - MARGIN - statusWidth,
    y,
    size: 10,
    font,
    color: rgb(0.35, 0.32, 0.3),
  });
  y -= 16;
  page.drawText(
    winAnsi(
      `Periodo: ${formatDateAR(input.periodStart)} - ${formatDateAR(input.periodEnd)}`,
    ),
    {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: rgb(0.35, 0.32, 0.3),
    },
  );
  y -= 20;

  page.drawText("Obra", {
    x: MARGIN,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.47, 0.44, 0.42),
  });
  y -= 13;
  y = drawWrapped(page, `${input.projectCode} · ${input.projectName}`, {
    x: MARGIN,
    y,
    font,
    size: 11,
    maxWidth: CONTENT_WIDTH,
  });
  if (input.projectAddress) {
    y -= 2;
    y = drawWrapped(page, input.projectAddress, {
      x: MARGIN,
      y,
      font,
      size: 9,
      maxWidth: CONTENT_WIDTH,
      color: rgb(0.47, 0.44, 0.42),
    });
  }
  y -= 10;

  if (input.clientName) {
    page.drawText("Cliente", {
      x: MARGIN,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.47, 0.44, 0.42),
    });
    y -= 13;
    page.drawText(winAnsi(input.clientName), {
      x: MARGIN,
      y,
      size: 11,
      font,
    });
    y -= 14;
    if (input.clientTaxId) {
      page.drawText(winAnsi(`CUIT: ${input.clientTaxId}`), {
        x: MARGIN,
        y,
        size: 9,
        font,
        color: rgb(0.47, 0.44, 0.42),
      });
      y -= 14;
    }
  }

  y -= 4;
  const totals: [string, string][] = [
    ["Bruto", formatCertMoney(input.grossAmount, input.currency)],
    [
      `Retencion (${input.retentionPct}%)`,
      formatCertMoney(input.retentionAmount, input.currency),
    ],
    ["Neto", formatCertMoney(input.netAmount, input.currency)],
  ];
  for (const [label, value] of totals) {
    ensureSpace(16);
    page.drawText(winAnsi(label), {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: rgb(0.35, 0.32, 0.3),
    });
    const vw = fontBold.widthOfTextAtSize(winAnsi(value), 11);
    page.drawText(winAnsi(value), {
      x: PAGE_WIDTH - MARGIN - vw,
      y,
      size: 11,
      font: fontBold,
    });
    y -= 16;
  }

  const balance =
    Math.round((input.netAmount - input.collectedAmount) * 100) / 100;
  if (input.collectedAmount > 0 || balance < input.netAmount) {
    ensureSpace(16);
    page.drawText("Cobrado", {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: rgb(0.35, 0.32, 0.3),
    });
    const cv = formatCertMoney(input.collectedAmount, input.currency);
    const cvw = font.widthOfTextAtSize(winAnsi(cv), 10);
    page.drawText(winAnsi(cv), {
      x: PAGE_WIDTH - MARGIN - cvw,
      y,
      size: 10,
      font,
    });
    y -= 16;
    ensureSpace(16);
    page.drawText("Saldo", {
      x: MARGIN,
      y,
      size: 10,
      font: fontBold,
    });
    const bv = formatCertMoney(balance, input.currency);
    const bvw = fontBold.widthOfTextAtSize(winAnsi(bv), 11);
    page.drawText(winAnsi(bv), {
      x: PAGE_WIDTH - MARGIN - bvw,
      y,
      size: 11,
      font: fontBold,
    });
    y -= 18;
  }

  if (input.notes?.trim()) {
    ensureSpace(30);
    page.drawText("Notas", {
      x: MARGIN,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.47, 0.44, 0.42),
    });
    y -= 13;
    y = drawWrapped(page, input.notes.trim(), {
      x: MARGIN,
      y,
      font,
      size: 10,
      maxWidth: CONTENT_WIDTH,
    });
    y -= 10;
  }

  ensureSpace(40);
  y -= 4;
  page.drawText("Detalle de partidas", {
    x: MARGIN,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.35, 0.32, 0.3),
  });
  y -= 14;

  const colCode = MARGIN;
  const colDesc = MARGIN + 52;
  const colPrev = MARGIN + 300;
  const colCurr = MARGIN + 345;
  const colPer = MARGIN + 395;
  const colAmt = PAGE_WIDTH - MARGIN;

  const header = (
    label: string,
    x: number,
    alignRight = false,
  ) => {
    const t = winAnsi(label);
    const w = font.widthOfTextAtSize(t, 8);
    page.drawText(t, {
      x: alignRight ? x - w : x,
      y,
      size: 8,
      font,
      color: rgb(0.47, 0.44, 0.42),
    });
  };
  header("Codigo", colCode);
  header("Descripcion", colDesc);
  header("Ant.", colPrev + 30, true);
  header("Acum.", colCurr + 30, true);
  header("Periodo", colPer + 35, true);
  header("Monto", colAmt, true);
  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.84, 0.83, 0.82),
  });
  y -= 12;

  for (const item of input.items) {
    const descLines = wrapText(item.description, font, 9, 230);
    const rowH = Math.max(14, descLines.length * 11 + 4);
    ensureSpace(rowH + 4);

    page.drawText(winAnsi(item.code), {
      x: colCode,
      y,
      size: 8,
      font,
      color: rgb(0.35, 0.32, 0.3),
    });

    let dy = y;
    for (const line of descLines) {
      page.drawText(winAnsi(line), {
        x: colDesc,
        y: dy,
        size: 9,
        font,
      });
      dy -= 11;
    }

    const drawRight = (text: string, x: number, bold = false) => {
      const f = bold ? fontBold : font;
      const t = winAnsi(text);
      const w = f.widthOfTextAtSize(t, 9);
      page.drawText(t, { x: x - w, y, size: 9, font: f });
    };
    drawRight(pct(item.previousPct), colPrev + 30);
    drawRight(pct(item.currentPct), colCurr + 30);
    drawRight(pct(item.periodPct), colPer + 35);
    drawRight(formatCertMoney(item.amount, input.currency), colAmt, true);

    y -= rowH;
  }

  y -= 24;
  ensureSpace(40);
  page.drawText(
    winAnsi(
      "Documento generado para el cliente. No constituye factura fiscal.",
    ),
    {
      x: MARGIN,
      y,
      size: 8,
      font,
      color: rgb(0.55, 0.52, 0.5),
    },
  );

  return pdf.save();
}

export function certificationPdfFilename(number: string) {
  const safe = number.replace(/[^\w.-]+/g, "_");
  return `certificacion-${safe}.pdf`;
}
