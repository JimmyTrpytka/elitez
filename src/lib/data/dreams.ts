import { createClient, type TypedSupabaseClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/supabase/database.types";
import {
  DREAM_PHOTOS_BUCKET,
  VEHICLE_PHOTOS_BUCKET,
  dreamPhotoPath,
  signFiles,
  vehiclePhotoPath,
} from "@/lib/storage";

export type DreamStatus = Enums<"dream_status">;

export type DreamView = {
  id: string;
  ownerId: string;
  make: string;
  model: string;
  yearFrom: number | null;
  yearTo: number | null;
  note: string | null;
  status: DreamStatus;
  visibility: Enums<"visibility">;
  /** Vlastní fotka, nebo hlavní fotka propojeného auta („Tohle chci!“) */
  photoUrl: string | null;
  /** Má vlastní nahranou fotku (ne převzatou z auta) */
  hasOwnPhoto: boolean;
  /** Propojené auto jiného člena – jen pokud je pořád vidět */
  linked: { vehicleId: string; ownerUsername: string | null } | null;
};

type DreamRow = Tables<"dream_cars"> & {
  vehicles: {
    id: string;
    owner: { username: string | null } | null;
    vehicle_photos: Array<{ id: string; format: string; position: number; created_at: string }>;
  } | null;
};

const SELECT =
  "*, vehicles(id, owner:profiles!vehicles_owner_id_fkey(username), vehicle_photos(id, format, position, created_at))";

async function toViews(supabase: TypedSupabaseClient, rows: DreamRow[]): Promise<DreamView[]> {
  const ownPaths = rows
    .filter((r) => r.photo_key && r.photo_format)
    .map((r) => dreamPhotoPath(r.owner_id, r.id, r.photo_key!, "md", r.photo_format!));
  const linkedCovers = new Map<string, string>();
  for (const r of rows) {
    if (r.photo_key || !r.vehicles) continue;
    const cover = [...r.vehicles.vehicle_photos].sort(
      (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
    )[0];
    if (cover) linkedCovers.set(r.id, vehiclePhotoPath(r.vehicles.id, cover.id, "md", cover.format));
  }
  const [own, linked] = await Promise.all([
    signFiles(supabase, DREAM_PHOTOS_BUCKET, ownPaths),
    signFiles(supabase, VEHICLE_PHOTOS_BUCKET, [...linkedCovers.values()]),
  ]);

  return rows.map((r) => {
    const ownPath =
      r.photo_key && r.photo_format
        ? dreamPhotoPath(r.owner_id, r.id, r.photo_key, "md", r.photo_format)
        : null;
    const linkedPath = linkedCovers.get(r.id);
    return {
      id: r.id,
      ownerId: r.owner_id,
      make: r.make,
      model: r.model,
      yearFrom: r.year_from,
      yearTo: r.year_to,
      note: r.note,
      status: r.status,
      visibility: r.visibility,
      hasOwnPhoto: Boolean(ownPath),
      photoUrl: (ownPath ? own.get(ownPath) : linkedPath ? linked.get(linkedPath) : null) ?? null,
      linked: r.vehicles
        ? { vehicleId: r.vehicles.id, ownerUsername: r.vehicles.owner?.username ?? null }
        : null,
    };
  });
}

/** Sny člena, které smí volající vidět (RLS: své vše, cizí jen veřejné). */
export async function listDreamsOfOwner(ownerId: string): Promise<DreamView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("dream_cars")
    .select(SELECT)
    .eq("owner_id", ownerId)
    .order("position")
    .order("created_at", { ascending: false });
  return toViews(supabase, (data ?? []) as unknown as DreamRow[]);
}

/** Jeden vlastní sen (pro úpravu). */
export async function getMyDream(id: string): Promise<DreamView | null> {
  const supabase = await createClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("dream_cars")
    .select(SELECT)
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (!data) return null;
  const [view] = await toViews(supabase, [data as unknown as DreamRow]);
  return view ?? null;
}

/** Má přihlášený uživatel toto auto v Garáži snů? */
export async function isVehicleInMyDreams(vehicleId: string): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { count } = await supabase
    .from("dream_cars")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", auth.user.id)
    .eq("linked_vehicle_id", vehicleId);
  return (count ?? 0) > 0;
}

/** Rok nebo rozsah let pro zobrazení. */
export function formatDreamYears(from: number | null, to: number | null): string | null {
  if (from && to) return from === to ? String(from) : `${from}–${to}`;
  return from ? String(from) : to ? String(to) : null;
}
