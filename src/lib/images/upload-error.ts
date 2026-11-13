import { ImageDecodeError } from "./resize";

/** Proč nahrání selhalo – klíč do překladů `Upload.*`. */
export type UploadErrorKind = "heic" | "format" | "size" | "network" | "permission" | "server";

/** Největší soubor, který vůbec zkusíme zpracovat (zmenšuje se v prohlížeči). */
export const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

function isHeic(file: File | undefined): boolean {
  return Boolean(file && (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)));
}

/** Kontrola ještě před zpracováním (null = v pořádku). */
export function precheckImage(file: File): UploadErrorKind | null {
  if (file.size > MAX_SOURCE_BYTES) return "size";
  if (file.type && !file.type.startsWith("image/")) return "format";
  return null;
}

/** Rozpozná druh chyby; podrobnosti zapíše do konzole (pro ladění). */
export function classifyUploadError(e: unknown, file?: File): UploadErrorKind {
  console.error("[ELITEZ] Nahrání obrázku selhalo:", e);
  if (e instanceof ImageDecodeError) return isHeic(e.file) ? "heic" : "format";
  const message = (e instanceof Error ? e.message : String(e ?? "")).toLowerCase();
  if (message.includes("mime") || message.includes("type")) return isHeic(file) ? "heic" : "format";
  if (message.includes("size") || message.includes("exceed") || message.includes("too large") || message.includes("413")) return "size";
  if (message.includes("row-level security") || message.includes("unauthorized") || message.includes("403") || message.includes("jwt")) return "permission";
  if (message.includes("failed to fetch") || message.includes("network") || message.includes("load failed")) return "network";
  return "server";
}
