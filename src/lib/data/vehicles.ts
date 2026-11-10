import { createClient, type TypedSupabaseClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import {
  VEHICLE_PHOTOS_BUCKET,
  signFiles,
  vehiclePhotoPath,
  type PhotoSize,
} from "@/lib/storage";

export type Vehicle = Tables<"vehicles">;
export type VehicleMod = Tables<"vehicle_mods">;
type PhotoRow = Tables<"vehicle_photos">;

export type PhotoView = {
  id: string;
  position: number;
  width: number | null;
  height: number | null;
  urls: Partial<Record<PhotoSize, string>>;
};

export type VehicleCardView = Vehicle & { cover: PhotoView | null };

export type VehicleOwner = {
  id: string;
  username: string | null;
  display_name: string | null;
};

export type VehicleDetailView = Vehicle & {
  photos: PhotoView[];
  mods: VehicleMod[];
  owner: VehicleOwner | null;
};

const PHOTO_COLUMNS = "id, vehicle_id, position, width, height, format, created_at";

function sortPhotos(photos: PhotoRow[]): PhotoRow[] {
  return [...photos].sort(
    (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
  );
}

/** Podepíše odkazy na fotky v požadovaných velikostech (jedním dotazem). */
async function signPhotos(
  supabase: TypedSupabaseClient,
  photos: PhotoRow[],
  sizes: PhotoSize[],
): Promise<PhotoView[]> {
  const paths = photos.flatMap((p) =>
    sizes.map((s) => vehiclePhotoPath(p.vehicle_id, p.id, s, p.format)),
  );
  const urls = await signFiles(supabase, VEHICLE_PHOTOS_BUCKET, paths);
  return photos.map((p) => ({
    id: p.id,
    position: p.position,
    width: p.width,
    height: p.height,
    urls: Object.fromEntries(
      sizes
        .map((s) => [s, urls.get(vehiclePhotoPath(p.vehicle_id, p.id, s, p.format))])
        .filter(([, url]) => Boolean(url)),
    ),
  }));
}

async function toCards(
  supabase: TypedSupabaseClient,
  rows: Array<Vehicle & { vehicle_photos: PhotoRow[] }>,
): Promise<VehicleCardView[]> {
  const covers = rows
    .map((r) => sortPhotos(r.vehicle_photos)[0])
    .filter((p): p is PhotoRow => Boolean(p));
  const signed = await signPhotos(supabase, covers, ["md"]);
  const byVehicle = new Map(covers.map((c, i) => [c.vehicle_id, signed[i]]));
  return rows.map((r) => {
    const { vehicle_photos: _photos, ...vehicle } = r;
    void _photos;
    return { ...vehicle, cover: byVehicle.get(r.id) ?? null };
  });
}

/** Vozidla přihlášeného uživatele (aktuální nebo archiv). */
export async function listMyVehicles(
  status: "current" | "former",
): Promise<VehicleCardView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data } = await supabase
    .from("vehicles")
    .select(`*, vehicle_photos(${PHOTO_COLUMNS})`)
    .eq("owner_id", auth.user.id)
    .eq("status", status)
    .order(status === "former" ? "sold_on" : "created_at", { ascending: false });
  return toCards(supabase, data ?? []);
}

/** Vozidla, která smí vidět návštěvník profilu (RLS skryje soukromá). */
export async function listVisibleVehiclesOfOwner(
  ownerId: string,
): Promise<VehicleCardView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("vehicles")
    .select(`*, vehicle_photos(${PHOTO_COLUMNS})`)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  return toCards(supabase, data ?? []);
}

/** Detail vozidla s fotkami a úpravami. Vrátí null, když ho uživatel nesmí vidět. */
export async function getVehicle(
  id: string,
  sizes: PhotoSize[] = ["sm", "md", "lg"],
): Promise<VehicleDetailView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("vehicles")
    .select(
      `*, vehicle_photos(${PHOTO_COLUMNS}), vehicle_mods(*), owner:profiles(id, username, display_name)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const { vehicle_photos, vehicle_mods, owner, ...vehicle } = data;
  const photos = await signPhotos(supabase, sortPhotos(vehicle_photos), sizes);
  const mods = [...vehicle_mods].sort(
    (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
  );
  return { ...vehicle, photos, mods, owner: owner ?? null };
}

/** Je přihlášený uživatel majitelem vozidla? */
export async function isMyVehicle(vehicle: Vehicle): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  return data.user?.id === vehicle.owner_id;
}
