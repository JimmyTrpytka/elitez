import { createClient, type TypedSupabaseClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/supabase/database.types";
import { AVATARS_BUCKET, CREW_IMAGES_BUCKET, crewImagePath, signFiles, type PhotoSize } from "@/lib/storage";

export type Crew = Tables<"crews">;
export type CrewRole = Enums<"crew_role">;

async function signCrewImage(
  supabase: TypedSupabaseClient,
  crewId: string,
  key: string | null,
  format: string | null,
  size: PhotoSize,
): Promise<string | null> {
  if (!key || !format) return null;
  const path = crewImagePath(crewId, key, size, format);
  return (await signFiles(supabase, CREW_IMAGES_BUCKET, [path])).get(path) ?? null;
}

export type CrewListItem = {
  id: string;
  slug: string;
  name: string;
  focus: string | null;
  description: string | null;
  logoUrl: string | null;
  joinPolicy: Enums<"crew_join_policy">;
  members: number;
  turbos: number;
};

export async function listPublicCrews(search: string, page: number): Promise<{ crews: CrewListItem[]; hasMore: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { crews: [], hasMore: false };
  const limit = 30;
  const { data } = await supabase.rpc("public_crews", {
    p_search: search || undefined,
    p_limit: limit + 1,
    p_offset: page * limit,
  });
  const rows = (data ?? []).slice(0, limit);
  const paths = rows
    .filter((r) => r.logo_key && r.logo_format)
    .map((r) => crewImagePath(r.id, r.logo_key!, "sm", r.logo_format!));
  const urls = await signFiles(supabase, CREW_IMAGES_BUCKET, paths);
  return {
    hasMore: (data ?? []).length > limit,
    crews: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      focus: r.focus,
      description: r.description,
      logoUrl:
        r.logo_key && r.logo_format ? (urls.get(crewImagePath(r.id, r.logo_key, "sm", r.logo_format)) ?? null) : null,
      joinPolicy: r.join_policy,
      members: r.members,
      turbos: r.turbos,
    })),
  };
}

export type CrewDetail = Crew & {
  logoUrl: string | null;
  coverUrl: string | null;
  stats: {
    members: number;
    pending: number;
    turbosTotal: number;
    turbosMonth: number;
    myStatus: "none" | "pending" | "active";
    myRole: CrewRole | null;
    myHome: boolean;
  };
};

/** Crew podle adresy (RLS: schválená, nebo vlastní / admin). */
export async function getCrewBySlug(slug: string): Promise<CrewDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from("crews").select("*").eq("slug", slug.toLowerCase()).maybeSingle();
  if (!data) return null;
  const [logoUrl, coverUrl, stats] = await Promise.all([
    signCrewImage(supabase, data.id, data.logo_key, data.logo_format, "md"),
    signCrewImage(supabase, data.id, data.cover_key, data.cover_format, "lg"),
    supabase.rpc("crew_stats", { p_crew_id: data.id }),
  ]);
  const s = stats.data?.[0];
  return {
    ...data,
    logoUrl,
    coverUrl,
    stats: {
      members: s?.members ?? 0,
      pending: s?.pending ?? 0,
      turbosTotal: s?.turbos_total ?? 0,
      turbosMonth: s?.turbos_month ?? 0,
      myStatus: (s?.my_status as "none" | "pending" | "active" | undefined) ?? "none",
      myRole: s?.my_role ?? null,
      myHome: s?.my_home ?? false,
    },
  };
}

export type CrewMember = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  verified: boolean;
  role: CrewRole;
  status: Enums<"crew_member_status">;
};

export async function listCrewMembers(crewId: string, includePending: boolean): Promise<CrewMember[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.rpc("crew_member_list", { p_crew_id: crewId, p_include_pending: includePending });
  const rows = data ?? [];
  const paths = rows.map((r) => r.avatar_path).filter((p): p is string => Boolean(p));
  const urls = await signFiles(supabase, AVATARS_BUCKET, paths);
  return rows.map((r) => ({
    userId: r.user_id,
    username: r.username,
    displayName: r.display_name,
    avatarUrl: r.avatar_path ? (urls.get(r.avatar_path) ?? null) : null,
    verified: r.verified,
    role: r.role,
    status: r.status,
  }));
}

export type CrewBadge = { id: string; contextKey: string; awardedAt: string; badge: Tables<"badges"> };

export async function listCrewBadges(crewId: string): Promise<CrewBadge[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("crew_badges")
    .select("id, context_key, awarded_at, badges(*)")
    .eq("crew_id", crewId)
    .order("awarded_at", { ascending: false });
  return (data ?? [])
    .filter((r) => r.badges)
    .map((r) => ({ id: r.id, contextKey: r.context_key, awardedAt: r.awarded_at, badge: r.badges as Tables<"badges"> }));
}

export type ProfileCrew = { id: string; slug: string; name: string; logoUrl: string | null; isHome: boolean; role: CrewRole };

/** Crew člena pro jeho profil (domovská první). */
export async function listProfileCrews(profileId: string): Promise<ProfileCrew[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.rpc("profile_crews", { p_profile_id: profileId });
  const rows = data ?? [];
  const paths = rows
    .filter((r) => r.logo_key && r.logo_format)
    .map((r) => crewImagePath(r.crew_id, r.logo_key!, "sm", r.logo_format!));
  const urls = await signFiles(supabase, CREW_IMAGES_BUCKET, paths);
  return rows.map((r) => ({
    id: r.crew_id,
    slug: r.slug,
    name: r.name,
    logoUrl:
      r.logo_key && r.logo_format ? (urls.get(crewImagePath(r.crew_id, r.logo_key, "sm", r.logo_format)) ?? null) : null,
    isHome: r.is_home,
    role: r.role,
  }));
}

/** Crew, které přihlášený založil (i čekající / zamítnuté). */
export async function listMyFoundedCrews(): Promise<Crew[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data } = await supabase
    .from("crews")
    .select("*")
    .eq("founder_id", auth.user.id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type CrewLeaderboardRow = {
  slug: string;
  name: string;
  focus: string | null;
  logoUrl: string | null;
  members: number;
  score: number;
};

export async function getCrewLeaderboard(mode: "size" | "active", period: string, limit = 10): Promise<CrewLeaderboardRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.rpc("leaderboard_crews", { p_mode: mode, p_period: period, p_limit: limit });
  const rows = data ?? [];
  const paths = rows
    .filter((r) => r.logo_key && r.logo_format)
    .map((r) => crewImagePath(r.crew_id, r.logo_key!, "sm", r.logo_format!));
  const urls = await signFiles(supabase, CREW_IMAGES_BUCKET, paths);
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    focus: r.focus,
    logoUrl:
      r.logo_key && r.logo_format ? (urls.get(crewImagePath(r.crew_id, r.logo_key, "sm", r.logo_format)) ?? null) : null,
    members: r.members,
    score: r.score,
  }));
}
