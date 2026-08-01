import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import "server-only";

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

const MEDIA_MAX_BYTES = 50 * 1024 * 1024;
const MEDIA_MAX_FILES = 8;

const MEDIA_IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const MEDIA_VIDEO_EXT = new Set(["mp4", "webm", "mov", "m4v", "avi"]);

function mediaExtensionOf(fileName: string, mimeType: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (MEDIA_IMAGE_EXT.has(fromName) || MEDIA_VIDEO_EXT.has(fromName)) {
    return fromName;
  }
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  if (mimeType === "video/mp4") return "mp4";
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "video/quicktime") return "mov";
  return "bin";
}

/** Imágenes o videos para solicitudes de mejora (scoped por organización). */
export async function saveFeatureRequestMediaFile(input: {
  organizationId: string;
  requestId: string;
  file: File;
}): Promise<{
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}> {
  const { organizationId, requestId, file } = input;
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error("Seleccioná un archivo.");
  }
  if (file.size > MEDIA_MAX_BYTES) {
    throw new Error("Cada archivo no puede superar 50 MB.");
  }

  const mime = file.type || "application/octet-stream";
  const ext = mediaExtensionOf(file.name, mime);
  const isImage =
    mime.startsWith("image/") || MEDIA_IMAGE_EXT.has(ext);
  const isVideo =
    mime.startsWith("video/") || MEDIA_VIDEO_EXT.has(ext);

  if (!isImage && !isVideo) {
    throw new Error(
      "Solo se permiten imágenes (PNG, JPG, WEBP, GIF) o videos (MP4, WEBM, MOV).",
    );
  }

  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "feature-requests",
    organizationId,
    requestId,
  );
  await mkdir(dir, { recursive: true });

  const safeBase =
    file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .slice(0, 60)
      .replace(/^-+|-+$/g, "") || "media";
  const unique = randomBytes(4).toString("hex");
  const storedName = `${Date.now()}-${unique}-${safeBase}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, storedName), buffer);

  return {
    fileUrl: `/uploads/feature-requests/${organizationId}/${requestId}/${storedName}`,
    fileName: file.name,
    fileSize: file.size,
    mimeType: mime,
  };
}

export function collectMediaFilesFromFormData(
  formData: FormData,
  fieldName = "media",
): File[] {
  const files: File[] = [];
  for (const entry of formData.getAll(fieldName)) {
    if (entry instanceof File && entry.size > 0) files.push(entry);
  }
  if (files.length > MEDIA_MAX_FILES) {
    throw new Error(`Podés adjuntar hasta ${MEDIA_MAX_FILES} archivos.`);
  }
  return files;
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
