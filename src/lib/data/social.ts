import { createClient } from "@/lib/supabase/server";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { AVATARS_BUCKET, VEHICLE_PHOTOS_BUCKET, signFiles, vehiclePhotoPath } from "@/lib/storage";

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

// ---------------------------------------------------------------------
// Síň slávy (odznaky)
// ---------------------------------------------------------------------

export type BadgeDef = Tables<"badges">;
export type BadgeRarity = Database["public"]["Enums"]["badge_rarity"];
export type EarnedBadge = {
  id: string;
  contextKey: string;
  source: string;
  awardedAt: string;
  badge: BadgeDef;
};

/** Odznaky člena (RLS: jen u viditelného profilu), nejvzácnější první. */
export async function listUserBadges(profileId: string): Promise<EarnedBadge[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("user_badges")
    .select("id, context_key, source, awarded_at, badges(*)")
    .eq("user_id", profileId)
    .order("awarded_at", { ascending: false });
  const order: Record<BadgeRarity, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };
  return (data ?? [])
    .filter((r) => r.badges)
    .map((r) => ({
      id: r.id,
      contextKey: r.context_key,
      source: r.source,
      awardedAt: r.awarded_at,
      badge: r.badges as BadgeDef,
    }))
    .sort((a, b) => order[a.badge.rarity] - order[b.badge.rarity] || a.badge.sort - b.badge.sort);
}

/** Celý katalog aktivních odznaků (pro „na cestě k dalším“). */
export async function listBadgeCatalog(): Promise<BadgeDef[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("badges").select("*").eq("active", true).order("sort");
  return data ?? [];
}

// ---------------------------------------------------------------------
// Žebříčky
// ---------------------------------------------------------------------
export const LEADERBOARD_PERIODS = ["week", "month", "year", "all"] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export type LeaderboardVehicle = {
  vehicleId: string;
  title: string;
  year: number | null;
  ownerUsername: string;
  ownerName: string;
  coverUrl: string | null;
  turbos: number;
};

export type LeaderboardMember = {
  username: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
  turbos: number;
};

export async function getLeaderboards(period: LeaderboardPeriod, limit = 10) {
  const supabase = await createClient();
  if (!supabase) return { vehicles: [], garages: [], fans: [] };
  const args = { p_period: period, p_limit: limit };
  const [v, g, f] = await Promise.all([
    supabase.rpc("leaderboard_vehicles", args),
    supabase.rpc("leaderboard_garages", args),
    supabase.rpc("leaderboard_fans", args),
  ]);

  const vehicleRows = v.data ?? [];
  const coverPaths = vehicleRows
    .filter((r) => r.cover_photo_id)
    .map((r) => vehiclePhotoPath(r.vehicle_id, r.cover_photo_id!, "md", r.cover_format ?? "webp"));
  const memberRows = [...(g.data ?? []), ...(f.data ?? [])];
  const avatarPaths = memberRows.map((r) => r.avatar_path).filter((p): p is string => Boolean(p));
  const [covers, avatars] = await Promise.all([
    signFiles(supabase, VEHICLE_PHOTOS_BUCKET, coverPaths),
    signFiles(supabase, AVATARS_BUCKET, avatarPaths),
  ]);

  const vehicles: LeaderboardVehicle[] = vehicleRows.map((r) => ({
    vehicleId: r.vehicle_id,
    title: `${r.make} ${r.model}`,
    year: r.year,
    ownerUsername: r.owner_username,
    ownerName: r.owner_display_name ?? `@${r.owner_username}`,
    coverUrl: r.cover_photo_id
      ? (covers.get(vehiclePhotoPath(r.vehicle_id, r.cover_photo_id, "md", r.cover_format ?? "webp")) ?? null)
      : null,
    turbos: r.turbos,
  }));
  const toMember = (r: (typeof memberRows)[number]): LeaderboardMember => ({
    username: r.username,
    name: r.display_name ?? `@${r.username}`,
    avatarUrl: r.avatar_path ? (avatars.get(r.avatar_path) ?? null) : null,
    verified: Boolean(r.verified_at),
    turbos: r.turbos,
  });
  return {
    vehicles,
    garages: (g.data ?? []).map(toMember),
    fans: (f.data ?? []).map(toMember),
  };
}
