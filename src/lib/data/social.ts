import { createClient } from "@/lib/supabase/server";
import { AVATARS_BUCKET, signFiles } from "@/lib/storage";

/** Turbo/sledování: počty čte databáze funkcemi, které vrací jen veřejná data. */

export type ProfileSocialStats = {
  garageTurbos: number;
  profileTurbos: number;
  receivedTotal: number;
  givenTotal: number;
  followers: number;
  following: number;
  streak: number;
  iFollow: boolean;
  iTurboed: boolean;
};

const EMPTY_STATS: ProfileSocialStats = {
  garageTurbos: 0,
  profileTurbos: 0,
  receivedTotal: 0,
  givenTotal: 0,
  followers: 0,
  following: 0,
  streak: 0,
  iFollow: false,
  iTurboed: false,
};

export async function getProfileSocialStats(profileId: string): Promise<ProfileSocialStats> {
  const supabase = await createClient();
  if (!supabase) return EMPTY_STATS;
  const { data } = await supabase.rpc("profile_social_stats", { p_profile_id: profileId });
  const r = data?.[0];
  if (!r) return EMPTY_STATS;
  return {
    garageTurbos: r.garage_turbos,
    profileTurbos: r.profile_turbos,
    receivedTotal: r.received_total,
    givenTotal: r.given_total,
    followers: r.followers,
    following: r.following,
    streak: r.streak,
    iFollow: r.i_follow,
    iTurboed: r.i_turboed,
  };
}

export type PhotoTurbo = { count: number; mine: boolean };

/** Turba jednotlivých fotek (a zda je dal přihlášený uživatel). */
export async function getPhotoTurbos(photoIds: string[]): Promise<Map<string, PhotoTurbo>> {
  const result = new Map<string, PhotoTurbo>();
  if (photoIds.length === 0) return result;
  const supabase = await createClient();
  if (!supabase) return result;
  const { data } = await supabase.rpc("photo_turbo_stats", { p_photo_ids: photoIds });
  for (const r of data ?? []) result.set(r.photo_id, { count: r.turbos, mine: r.mine });
  return result;
}

export type VehicleSocial = { turbos: number; dreamers: number };

/** Součet turb vozidla (všechny fotky) a počet lidí, kteří ho mají v Garáži snů. */
export async function getVehicleSocial(vehicleIds: string[]): Promise<Map<string, VehicleSocial>> {
  const result = new Map<string, VehicleSocial>();
  if (vehicleIds.length === 0) return result;
  const supabase = await createClient();
  if (!supabase) return result;
  const { data } = await supabase.rpc("vehicle_social_stats", { p_vehicle_ids: vehicleIds });
  for (const r of data ?? []) result.set(r.vehicle_id, { turbos: r.turbos, dreamers: r.dreamers });
  return result;
}

export type TurboGiver = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

/** Kdo dal turbo (jen veřejné profily, nejnovější první). */
export async function listTurboGivers(
  target: { photoId: string } | { vehicleId: string } | { profileId: string },
  limit = 12,
): Promise<TurboGiver[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.rpc("turbo_givers", {
    p_photo_id: "photoId" in target ? target.photoId : undefined,
    p_vehicle_id: "vehicleId" in target ? target.vehicleId : undefined,
    p_profile_id: "profileId" in target ? target.profileId : undefined,
    p_limit: limit,
  });
  const rows = data ?? [];
  const paths = rows.map((r) => r.avatar_path).filter((p): p is string => Boolean(p));
  const urls = await signFiles(supabase, AVATARS_BUCKET, paths);
  return rows.map((r) => ({
    username: r.username,
    displayName: r.display_name,
    avatarUrl: r.avatar_path ? (urls.get(r.avatar_path) ?? null) : null,
  }));
}
