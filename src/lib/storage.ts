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

export const EVENT_IMAGES_BUCKET = "event-images";

/** Cesta k obrázku eventu: `{event_id}/{image_id}-{velikost}.{format}` (coverPath = bez přípony). */
export function eventImagePath(coverPath: string, size: PhotoSize, format: string): string {
  return `${coverPath}-${size}.${format}`;
}

export const DREAM_PHOTOS_BUCKET = "dream-photos";

/** Fotka v Garáži snů: `{owner_id}/{dream_id}/{photo_key}-{velikost}.{format}`. */
export function dreamPhotoPath(
  ownerId: string,
  dreamId: string,
  photoKey: string,
  size: PhotoSize,
  format: string,
): string {
  return `${ownerId}/${dreamId}/${photoKey}-${size}.${format}`;
}

export const ORGANIZER_LOGOS_BUCKET = "organizer-logos";

/** Logo pořadatele: `{organizer_id}/{logo_key}-{velikost}.{format}`. */
export function organizerLogoPath(
  organizerId: string,
  logoKey: string,
  size: PhotoSize,
  format: string,
): string {
  return `${organizerId}/${logoKey}-${size}.${format}`;
}

export const CREW_IMAGES_BUCKET = "crew-images";

/** Logo / úvodní fotka crew: `{crew_id}/{key}-{velikost}.{format}`. */
export function crewImagePath(crewId: string, key: string, size: PhotoSize, format: string): string {
  return `${crewId}/${key}-${size}.${format}`;
}

export const PROFILE_MEDIA_BUCKET = "profile-media";

/** Úvodní (cover) fotka profilu: `{user_id}/cover/{key}-{velikost}.{format}`. */
export function profileCoverPath(userId: string, key: string, size: PhotoSize, format: string): string {
  return `${userId}/cover/${key}-${size}.${format}`;
}

/** Fotka / náhled v portfoliu: `{user_id}/portfolio/{item_id}/{key}-{velikost}.{format}`. */
export function portfolioPath(
  userId: string,
  itemId: string,
  key: string,
  size: PhotoSize,
  format: string,
): string {
  return `${userId}/portfolio/${itemId}/${key}-${size}.${format}`;
}
