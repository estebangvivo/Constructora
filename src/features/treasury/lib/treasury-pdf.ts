import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatMoney, PAYMENT_METHOD_LABEL, TREASURY_STATUS_LABEL } from "@/features/treasury/lib/labels";
import { formatDateAR } from "@/lib/format-date";
import type { PaymentMethod, TreasuryDocStatus } from "@prisma/client";

export type TreasuryPdfPayment = {
  method: PaymentMethod;
  amount: number;
  checkNumber?: string | null;
  checkBank?: string | null;
  isElectronicCheck?: boolean;
  bankAccountName?: string | null;
};

export type TreasuryPdfLine = {
  description: string;
  projectLabel?: string | null;
  budgetItemLabel?: string | null;
  amount: number;
};

export type TreasuryPdfInput = {
  kind: "receipt" | "payment-order";
  number: string;
  status: TreasuryDocStatus;
  issueDate: Date | string;
  partyName: string;
  partyTaxId?: string | null;
  totalAmount: number;
  currency: string;
  concept?: string | null;
  notes?: string | null;
  organizationName: string;
  organizationTaxId?: string | null;
  organizationAddress?: string | null;
  /** PNG o JPG; pdf-lib no embebe WEBP/SVG. */
  organizationLogo?: {
    bytes: Uint8Array;
    format: "png" | "jpg";
  } | null;
  payments: TreasuryPdfPayment[];
  lines: TreasuryPdfLine[];
};

const MARGIN = 48;
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Helvetica/WinAnsi: reemplaza glifos que rompen el PDF. */
function winAnsi(text: string): string {
  return text
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x00-\xFF]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
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

export async function buildTreasuryDocPdf(
  input: TreasuryPdfInput,
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

  const title = input.kind === "receipt" ? "RECIBO" : "ORDEN DE PAGO";
  const partyLabel = input.kind === "receipt" ? "Cliente" : "Beneficiario";

  const LOGO_MAX_H = 52;
  const LOGO_MAX_W = 120;
  let headerLeft = MARGIN;
  let headerTextTop = y;
  let logoBottom = y;

  if (input.organizationLogo) {
    try {
      const embedded =
        input.organizationLogo.format === "png"
          ? await pdf.embedPng(input.organizationLogo.bytes)
          : await pdf.embedJpg(input.organizationLogo.bytes);
      const scale = Math.min(
        LOGO_MAX_W / embedded.width,
        LOGO_MAX_H / embedded.height,
        1,
      );
      const logoW = embedded.width * scale;
      const logoH = embedded.height * scale;
      const logoY = y - logoH + 4;
      page.drawImage(embedded, {
        x: MARGIN,
        y: logoY,
        width: logoW,
        height: logoH,
      });
      headerLeft = MARGIN + logoW + 14;
      logoBottom = logoY;
      headerTextTop = y - Math.max(0, (LOGO_MAX_H - 14) / 4);
    } catch {
      // Logo inválido: seguir solo con texto
    }
  }

  let textY = headerTextTop;
  const textMaxWidth = PAGE_WIDTH - MARGIN - headerLeft;

  page.drawText(winAnsi(input.organizationName), {
    x: headerLeft,
    y: textY,
    size: 14,
    font: fontBold,
    color: rgb(0.11, 0.1, 0.09),
  });
  textY -= 18;

  if (input.organizationTaxId) {
    page.drawText(winAnsi(`CUIT: ${input.organizationTaxId}`), {
      x: headerLeft,
      y: textY,
      size: 9,
      font,
      color: rgb(0.35, 0.32, 0.3),
    });
    textY -= 12;
  }
  if (input.organizationAddress) {
    textY = drawWrapped(page, input.organizationAddress, {
      x: headerLeft,
      y: textY,
      font,
      size: 9,
      maxWidth: textMaxWidth,
      color: rgb(0.35, 0.32, 0.3),
    });
    textY -= 4;
  }

  y = Math.min(textY, logoBottom) - 12;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0.84, 0.83, 0.82),
  });
  y -= 28;

  page.drawText(title, {
    x: MARGIN,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.11, 0.1, 0.09),
  });
  const numberLabel = winAnsi(input.number);
  const numberWidth = fontBold.widthOfTextAtSize(numberLabel, 14);
  page.drawText(numberLabel, {
    x: PAGE_WIDTH - MARGIN - numberWidth,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.11, 0.1, 0.09),
  });
  y -= 18;

  page.drawText(
    winAnsi(
      `Estado: ${TREASURY_STATUS_LABEL[input.status]} - Fecha: ${formatDateAR(input.issueDate)}`,
    ),
    {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: rgb(0.35, 0.32, 0.3),
    },
  );
  y -= 24;

  page.drawText(winAnsi(`${partyLabel}: ${input.partyName}`), {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.11, 0.1, 0.09),
  });
  y -= 14;
  if (input.partyTaxId) {
    page.drawText(winAnsi(`CUIT: ${input.partyTaxId}`), {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: rgb(0.35, 0.32, 0.3),
    });
    y -= 14;
  }

  if (input.concept?.trim()) {
    y -= 4;
    page.drawText("Concepto", {
      x: MARGIN,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.35, 0.32, 0.3),
    });
    y -= 13;
    y = drawWrapped(page, input.concept.trim(), {
      x: MARGIN,
      y,
      font,
      size: 10,
      maxWidth: CONTENT_WIDTH,
    });
    y -= 8;
  }

  ensureSpace(40);
  y -= 4;
  page.drawText("Medios de pago", {
    x: MARGIN,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.35, 0.32, 0.3),
  });
  y -= 14;

  for (const p of input.payments) {
    ensureSpace(16);
    const parts = [
      PAYMENT_METHOD_LABEL[p.method],
      formatMoney(p.amount, input.currency),
    ];
    if (p.method === "CHECK" && (p.checkNumber || p.checkBank)) {
      parts.push(
        [
          p.isElectronicCheck ? "Electrónico" : null,
          p.checkNumber,
          p.checkBank,
        ]
          .filter(Boolean)
          .join(" - "),
      );
    }
    if (p.method === "TRANSFER" && p.bankAccountName) {
      parts.push(p.bankAccountName);
    }
    page.drawText(winAnsi(`- ${parts.join(" - ")}`), {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: rgb(0.11, 0.1, 0.09),
    });
    y -= 14;
  }

  y -= 10;
  ensureSpace(50);
  page.drawText("Detalle", {
    x: MARGIN,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.35, 0.32, 0.3),
  });
  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.84, 0.83, 0.82),
  });
  y -= 14;

  const colDesc = MARGIN;
  const colAmount = PAGE_WIDTH - MARGIN;
  const descWidth = CONTENT_WIDTH - 90;

  for (const line of input.lines) {
    ensureSpace(36);
    const amountText = winAnsi(formatMoney(line.amount, input.currency));
    const amountW = font.widthOfTextAtSize(amountText, 10);
    page.drawText(amountText, {
      x: colAmount - amountW,
      y,
      size: 10,
      font,
      color: rgb(0.11, 0.1, 0.09),
    });

    const startY = y;
    y = drawWrapped(page, line.description || "-", {
      x: colDesc,
      y,
      font,
      size: 10,
      maxWidth: descWidth,
    });

    const meta = [line.projectLabel, line.budgetItemLabel]
      .filter(Boolean)
      .join(" - ");
    if (meta) {
      y = drawWrapped(page, meta, {
        x: colDesc,
        y: y - 2,
        font,
        size: 8,
        maxWidth: descWidth,
        color: rgb(0.47, 0.44, 0.42),
        lineHeight: 10,
      });
    }

    void startY;
    y -= 10;
  }

  y -= 6;
  ensureSpace(40);
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0.84, 0.83, 0.82),
  });
  y -= 20;

  const totalLabel = "TOTAL";
  const totalValue = winAnsi(formatMoney(input.totalAmount, input.currency));
  page.drawText(totalLabel, {
    x: MARGIN,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.11, 0.1, 0.09),
  });
  const totalW = fontBold.widthOfTextAtSize(totalValue, 14);
  page.drawText(totalValue, {
    x: PAGE_WIDTH - MARGIN - totalW,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.11, 0.1, 0.09),
  });
  y -= 24;

  if (input.notes?.trim()) {
    ensureSpace(40);
    page.drawText("Notas", {
      x: MARGIN,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.35, 0.32, 0.3),
    });
    y -= 13;
    y = drawWrapped(page, input.notes.trim(), {
      x: MARGIN,
      y,
      font,
      size: 9,
      maxWidth: CONTENT_WIDTH,
      color: rgb(0.35, 0.32, 0.3),
    });
  }

  return pdf.save();
}

export function treasuryPdfFilename(kind: "receipt" | "payment-order", number: string) {
  const safe = number.replace(/[^\w.-]+/g, "_");
  const prefix = kind === "receipt" ? "recibo" : "orden-pago";
  return `${prefix}-${safe}.pdf`;
}
