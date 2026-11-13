"use client";

import { loadImage, resizeImage, supportsWebpEncoding, type ImageFormat } from "@/lib/images/resize";
import { classifyUploadError, precheckImage, type UploadErrorKind } from "@/lib/images/upload-error";
import { createBrowserSupabase } from "@/lib/supabase/client";
import type { PhotoSize } from "@/lib/storage";

/** Běžné velikosti fotek (náhled, střední, velká). */
export const PHOTO_VARIANTS: Array<[PhotoSize, number]> = [
  ["sm", 480],
  ["md", 1200],
  ["lg", 2048],
];

export type UploadedVariants =
  | { ok: true; format: ImageFormat; width: number; height: number; paths: string[] }
  | { ok: false; error: UploadErrorKind };

/**
 * Zmenší fotku v prohlížeči do více velikostí a nahraje je do úložiště.
 * Při chybě po sobě uklidí už nahrané soubory.
 */
export async function uploadVariants(
  file: File,
  bucket: string,
  pathFor: (size: PhotoSize, format: ImageFormat) => string,
  variants: Array<[PhotoSize, number]> = PHOTO_VARIANTS,
): Promise<UploadedVariants> {
  const pre = precheckImage(file);
  if (pre) return { ok: false, error: pre };
  let bitmap: ImageBitmap;
  try {
    bitmap = await loadImage(file);
  } catch (e) {
    return { ok: false, error: classifyUploadError(e, file) };
  }
  const supabase = createBrowserSupabase();
  const uploaded: string[] = [];
  try {
    const useJpeg = !supportsWebpEncoding();
    let format: ImageFormat = useJpeg ? "jpg" : "webp";
    let width = bitmap.width;
    let height = bitmap.height;
    for (const [size, max] of variants) {
      const image = await resizeImage(bitmap, max, { preferJpeg: useJpeg });
      format = image.format;
      width = image.width;
      height = image.height;
      const path = pathFor(size, image.format);
      const { error } = await supabase.storage.from(bucket).upload(path, image.blob, { contentType: image.contentType });
      if (error) throw error;
      uploaded.push(path);
    }
    return { ok: true, format, width, height, paths: uploaded };
  } catch (e) {
    if (uploaded.length) await supabase.storage.from(bucket).remove(uploaded);
    return { ok: false, error: classifyUploadError(e, file) };
  } finally {
    bitmap.close();
  }
}

/** Úklid nahraných souborů, když se je nepodařilo zapsat do databáze. */
export async function removeUploaded(bucket: string, paths: string[]) {
  if (paths.length) await createBrowserSupabase().storage.from(bucket).remove(paths);
}
