"use client";

/**
 * Zmenšení fotky přímo v prohlížeči před nahráním.
 * - šetří data uživatele i úložiště (náklady),
 * - nový obrázek NEOBSAHUJE metadata EXIF (např. GPS polohu garáže).
 * Safari neumí uložit WebP – pak se použije JPEG.
 */

export type ImageFormat = "webp" | "jpg";

export type ResizedImage = {
  blob: Blob;
  width: number;
  height: number;
  format: ImageFormat;
  contentType: "image/webp" | "image/jpeg";
};

export async function loadImage(file: File): Promise<ImageBitmap> {
  // Prohlížeč sám otočí fotku podle EXIF orientace
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Zmenší obrázek tak, aby delší strana měla nejvýš `maxSize` px.
 * `square: true` ořízne střed na čtverec (avatar).
 * `preferJpeg: true` vynutí JPEG (aby všechny velikosti jedné fotky měly stejný formát).
 */
export async function resizeImage(
  source: ImageBitmap,
  maxSize: number,
  options: { square?: boolean; preferJpeg?: boolean } = {},
): Promise<ResizedImage> {
  let sx = 0;
  let sy = 0;
  let sw = source.width;
  let sh = source.height;

  if (options.square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = side;
    sh = side;
  }

  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);

  if (!options.preferJpeg) {
    const webp = await toBlob(canvas, "image/webp", 0.82);
    if (webp && webp.type === "image/webp") {
      return { blob: webp, width, height, format: "webp", contentType: "image/webp" };
    }
  }
  const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) throw new Error("Image encoding failed");
  return { blob: jpeg, width, height, format: "jpg", contentType: "image/jpeg" };
}

/** Umí tento prohlížeč uložit WebP? (Safari ne.) */
export function supportsWebpEncoding(): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}
