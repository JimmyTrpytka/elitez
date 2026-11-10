import type { TypedSupabaseClient } from "@/lib/supabase/server";

export const AVATARS_BUCKET = "avatars";
export const VEHICLE_PHOTOS_BUCKET = "vehicle-photos";

/** Platnost dočasných odkazů na soubory (1 hodina). */
const SIGNED_URL_TTL = 60 * 60;

/**
 * Vytvoří dočasné odkazy na soukromé soubory. Supabase odkaz vydá jen tehdy,
 * když RLS dovolí soubor číst (soukromé vozidlo cizí uživatel nedostane).
 */
export async function signFiles(
  supabase: TypedSupabaseClient,
  bucket: string,
  paths: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, SIGNED_URL_TTL);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) {
      result.set(item.path, item.signedUrl);
    }
  }
  return result;
}

export type PhotoSize = "sm" | "md" | "lg";

/** Cesta k souboru fotky vozidla v úložišti. */
export function vehiclePhotoPath(
  vehicleId: string,
  photoId: string,
  size: PhotoSize,
  format: string,
): string {
  return `${vehicleId}/${photoId}-${size}.${format}`;
}
