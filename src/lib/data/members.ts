import { createClient } from "@/lib/supabase/server";
import { AVATARS_BUCKET, signFiles } from "@/lib/storage";

export type MemberCard = {
  id: string;
  username: string;
  displayName: string | null;
  country: string | null;
  city: string | null;
  verified: boolean;
  vehicleCount: number;
  avatarUrl: string | null;
};

export const MEMBERS_PAGE_SIZE = 48;

/** Veřejní členové (jen veřejné profily – hlídá databázová funkce). */
export async function listPublicMembers(
  search: string,
  page: number,
): Promise<{ members: MemberCard[]; hasMore: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { members: [], hasMore: false };
  const { data } = await supabase.rpc("public_members", {
    p_search: search || undefined,
    p_limit: MEMBERS_PAGE_SIZE + 1,
    p_offset: page * MEMBERS_PAGE_SIZE,
  });
  const rows = data ?? [];
  const pageRows = rows.slice(0, MEMBERS_PAGE_SIZE);
  const avatars = await signFiles(
    supabase,
    AVATARS_BUCKET,
    pageRows.map((r) => r.avatar_path).filter((p): p is string => Boolean(p)),
  );
  return {
    hasMore: rows.length > MEMBERS_PAGE_SIZE,
    members: pageRows
      .filter((r): r is typeof r & { username: string } => Boolean(r.username))
      .map((r) => ({
        id: r.id,
        username: r.username,
        displayName: r.display_name,
        country: r.country,
        city: r.city,
        verified: Boolean(r.verified_at),
        vehicleCount: Number(r.vehicle_count),
        avatarUrl: r.avatar_path ? (avatars.get(r.avatar_path) ?? null) : null,
      })),
  };
}
