import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/server";
import {
  AVATARS_BUCKET,
  EVENT_IMAGES_BUCKET,
  ORGANIZER_LOGOS_BUCKET,
  organizerLogoPath,
  VEHICLE_PHOTOS_BUCKET,
  eventImagePath,
  signFiles,
  vehiclePhotoPath,
} from "@/lib/storage";

/**
 * Náhledy odkazů (WhatsApp, Messenger, Facebook…): název, popis a velká fotka.
 * Čte se jako nepřihlášený návštěvník → soukromý obsah se do náhledu nedostane.
 * Podepsané odkazy na fotky platí hodinu; aplikace si náhled stahují hned při sdílení.
 */
export type ShareInfo = { title: string; description: string; image: string | null };

function short(text: string | null | undefined, max = 180): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export async function getVehicleShare(id: string): Promise<ShareInfo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createPublicClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("vehicles")
    .select("id, make, model, year, description, owner:profiles!vehicles_owner_id_fkey(username), vehicle_photos(id, format, position, created_at)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const cover = [...data.vehicle_photos].sort(
    (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
  )[0];
  const path = cover ? vehiclePhotoPath(data.id, cover.id, "lg", cover.format) : null;
  const urls = path ? await signFiles(supabase, VEHICLE_PHOTOS_BUCKET, [path]) : null;
  const title = [data.make, data.model, data.year].filter(Boolean).join(" ");
  return {
    title,
    description: short(data.description) || (data.owner?.username ? `@${data.owner.username} · ELITEZ` : "ELITEZ"),
    image: path ? (urls?.get(path) ?? null) : null,
  };
}

export async function getProfileShare(username: string): Promise<ShareInfo | null> {
  const supabase = await createPublicClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_path")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (!data?.username) return null;
  // Obrázek: hlavní fotka prvního veřejného auta, jinak profilová fotka
  const { data: car } = await supabase
    .from("vehicles")
    .select("id, vehicle_photos(id, format, position, created_at)")
    .eq("owner_id", data.id)
    .eq("status", "current")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const cover = car
    ? [...car.vehicle_photos].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))[0]
    : undefined;
  let image: string | null = null;
  if (car && cover) {
    const path = vehiclePhotoPath(car.id, cover.id, "lg", cover.format);
    image = (await signFiles(supabase, VEHICLE_PHOTOS_BUCKET, [path])).get(path) ?? null;
  } else if (data.avatar_path) {
    image = (await signFiles(supabase, AVATARS_BUCKET, [data.avatar_path])).get(data.avatar_path) ?? null;
  }
  return {
    title: `${data.display_name ?? data.username} (@${data.username})`,
    description: short(data.bio) || "ELITEZ",
    image,
  };
}

export async function getEventShare(slug: string): Promise<ShareInfo | null> {
  const supabase = await createPublicClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("events")
    .select("title, description, venue_name, cover_path, cover_format")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const path =
    data.cover_path && data.cover_format ? eventImagePath(data.cover_path, "lg", data.cover_format) : null;
  const image = path ? ((await signFiles(supabase, EVENT_IMAGES_BUCKET, [path])).get(path) ?? null) : null;
  return {
    title: data.title,
    description: short(data.description) || short(data.venue_name) || "ELITEZ",
    image,
  };
}

export async function getOrganizerShare(slug: string): Promise<ShareInfo | null> {
  const supabase = await createPublicClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("organizers")
    .select("id, name, description, logo_key, logo_format")
    .eq("slug", slug.toLowerCase())
    .eq("status", "approved")
    .maybeSingle();
  if (!data) return null;
  const path =
    data.logo_key && data.logo_format ? organizerLogoPath(data.id, data.logo_key, "md", data.logo_format) : null;
  const image = path ? ((await signFiles(supabase, ORGANIZER_LOGOS_BUCKET, [path])).get(path) ?? null) : null;
  return { title: data.name, description: short(data.description) || "ELITEZ", image };
}

/** Převede náhled na metadata stránky (Open Graph + Twitter). */
export function shareMetadata(info: ShareInfo | null, fallbackTitle: string): Metadata {
  if (!info) return { title: fallbackTitle };
  const images = info.image ? [{ url: info.image, width: 2048, alt: info.title }] : undefined;
  return {
    title: info.title,
    description: info.description,
    openGraph: { title: info.title, description: info.description, images, type: "website", siteName: "ELITEZ" },
    twitter: { card: info.image ? "summary_large_image" : "summary", title: info.title, description: info.description, images: info.image ? [info.image] : undefined },
  };
}
