"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { EVENT_GALLERY_BUCKET, eventGalleryPath } from "@/lib/storage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIZES = ["sm", "md", "lg"] as const;

export type GalleryError = "notAllowed" | "galleryLimit" | "generic";
export type GalleryResult = { ok: true } | { ok: false; error: GalleryError };

function refresh() {
  revalidatePath("/", "layout");
}

/** Pořadatel: zapíše fotku, kterou prohlížeč nahrál do galerie eventu. */
export async function addEventPhoto(input: {
  eventId: string;
  photoId: string;
  key: string;
  format: string;
  width: number;
  height: number;
}): Promise<GalleryResult> {
  if (![input.eventId, input.photoId, input.key].every((x) => UUID.test(x))) return { ok: false, error: "notAllowed" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const format = input.format === "jpg" ? "jpg" : "webp";
  const { error } = await supabase.from("event_photos").insert({
    id: input.photoId,
    event_id: input.eventId,
    photo_key: input.key,
    photo_format: format,
    width: Math.max(1, Math.round(input.width)) || null,
    height: Math.max(1, Math.round(input.height)) || null,
  });
  if (error) {
    await supabase.storage
      .from(EVENT_GALLERY_BUCKET)
      .remove(SIZES.map((s) => eventGalleryPath(input.eventId, input.photoId, input.key, s, format)));
    return { ok: false, error: error.message === "gallery_limit" ? "galleryLimit" : "notAllowed" };
  }
  refresh();
  return { ok: true };
}

/** Pořadatel: smaže fotku z galerie i se soubory. */
export async function deleteEventPhoto(photoId: string): Promise<GalleryResult> {
  if (!UUID.test(photoId)) return { ok: false, error: "notAllowed" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { data: photo } = await supabase
    .from("event_photos")
    .select("id, event_id, photo_key, photo_format")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return { ok: false, error: "notAllowed" };
  const { data, error } = await supabase.from("event_photos").delete().eq("id", photoId).select("id");
  if (error || !data?.length) return { ok: false, error: "notAllowed" };
  await supabase.storage
    .from(EVENT_GALLERY_BUCKET)
    .remove(SIZES.map((s) => eventGalleryPath(photo.event_id, photo.id, photo.photo_key, s, photo.photo_format)));
  refresh();
  return { ok: true };
}

/** Pořadatel: skrýt / znovu ukázat práci médií v galerii. */
export async function setEventWorkHidden(itemId: string, hidden: boolean): Promise<GalleryResult> {
  if (!UUID.test(itemId)) return { ok: false, error: "notAllowed" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("set_event_photo_hidden", { p_item_id: itemId, p_hidden: hidden });
  if (error) return { ok: false, error: "notAllowed" };
  refresh();
  return { ok: true };
}

/** Majitel auta odebere označení svého auta z cizí fotky. */
export async function untagMyVehicle(itemId: string): Promise<GalleryResult> {
  if (!UUID.test(itemId)) return { ok: false, error: "notAllowed" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("untag_vehicle_photo", { p_item_id: itemId });
  if (error) return { ok: false, error: "notAllowed" };
  refresh();
  return { ok: true };
}
