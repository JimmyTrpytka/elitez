import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { ORGANIZER_LOGOS_BUCKET, organizerLogoPath, signFiles } from "@/lib/storage";

export type OrganizerListItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  followers: number;
  upcomingEvents: number;
};

/** Schválení pořadatelé pro veřejný seznam (nejvíc nadcházejících eventů první). */
export async function listPublicOrganizers(): Promise<OrganizerListItem[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.rpc("public_organizers");
  const rows = data ?? [];
  const paths = rows
    .filter((r) => r.logo_key && r.logo_format)
    .map((r) => organizerLogoPath(r.id, r.logo_key!, "sm", r.logo_format!));
  const urls = await signFiles(supabase, ORGANIZER_LOGOS_BUCKET, paths);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    logoUrl:
      r.logo_key && r.logo_format
        ? (urls.get(organizerLogoPath(r.id, r.logo_key, "sm", r.logo_format)) ?? null)
        : null,
    followers: r.followers,
    upcomingEvents: r.upcoming_events,
  }));
}

export type OrganizerProfile = Tables<"organizers"> & {
  logoUrl: string | null;
  followers: number;
  iFollow: boolean;
};

/** Veřejný profil pořadatele podle adresy (jen schválený). */
export async function getOrganizerBySlug(slug: string): Promise<OrganizerProfile | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("organizers")
    .select("*")
    .eq("slug", slug.toLowerCase())
    .eq("status", "approved")
    .maybeSingle();
  if (!data) return null;
  const path =
    data.logo_key && data.logo_format
      ? organizerLogoPath(data.id, data.logo_key, "md", data.logo_format)
      : null;
  const [urls, stats] = await Promise.all([
    path ? signFiles(supabase, ORGANIZER_LOGOS_BUCKET, [path]) : Promise.resolve(new Map<string, string>()),
    supabase.rpc("organizer_social_stats", { p_organizer_id: data.id }),
  ]);
  return {
    ...data,
    logoUrl: path ? (urls.get(path) ?? null) : null,
    followers: stats.data?.[0]?.followers ?? 0,
    iFollow: stats.data?.[0]?.i_follow ?? false,
  };
}
