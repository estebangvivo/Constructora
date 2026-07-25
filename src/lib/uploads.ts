import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "application/acad",
  "application/x-acad",
  "application/autocad_dwg",
  "application/dwg",
  "application/x-dwg",
  "image/vnd.dwg",
  "application/octet-stream",
]);

const ALLOWED_EXT = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
  "txt",
  "csv",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "zip",
  "dwg",
  "dxf",
  "rvt",
  "ifc",
]);

function extensionOf(fileName: string, mimeType: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ALLOWED_EXT.has(fromName)) return fromName;
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  return "bin";
}

export async function saveProjectUploadFile(input: {
  projectId: string;
  file: File;
  folder: "documents" | "invoices" | "punch-list";
  allowedKinds?: "documents" | "invoices";
}): Promise<{
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  buffer: Buffer;
}> {
  const { projectId, file, folder } = input;
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error("Seleccioná un archivo.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("El archivo no puede superar 25 MB.");
  }

  const ext = extensionOf(file.name, file.type || "");
  const mime = file.type || "application/octet-stream";
  const kinds = input.allowedKinds ?? "documents";

  if (kinds === "invoices") {
    const ok =
      mime === "application/pdf" ||
      mime.startsWith("image/") ||
      ["pdf", "png", "jpg", "jpeg", "webp"].includes(ext);
    if (!ok) {
      throw new Error("La factura debe ser PDF o imagen (PNG/JPG/WEBP).");
    }
  } else if (!ALLOWED_MIME.has(mime) && !ALLOWED_EXT.has(ext)) {
    throw new Error(
      "Formato no permitido. Usá PDF, imágenes, Office, ZIP, DWG/DXF u otros planos comunes.",
    );
  }

  const dir = path.join(process.cwd(), "public", "uploads", folder, projectId);
  await mkdir(dir, { recursive: true });

  const safeBase =
    file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .slice(0, 60)
      .replace(/^-+|-+$/g, "") || "archivo";
  const unique = randomBytes(4).toString("hex");
  const storedName = `${Date.now()}-${unique}-${safeBase}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, storedName), buffer);

  return {
    fileUrl: `/uploads/${folder}/${projectId}/${storedName}`,
    fileName: file.name,
    fileSize: file.size,
    mimeType: mime,
    buffer,
  };
}

export async function saveProjectDocumentFile(input: {
  projectId: string;
  file: File;
}): Promise<{
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}> {
  const saved = await saveProjectUploadFile({
    ...input,
    folder: "documents",
    allowedKinds: "documents",
  });
  return {
    fileUrl: saved.fileUrl,
    fileName: saved.fileName,
    fileSize: saved.fileSize,
    mimeType: saved.mimeType,
  };
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
