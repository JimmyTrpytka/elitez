import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { AVATARS_BUCKET, signFiles } from "@/lib/storage";

export type MediaRequest = Tables<"event_media_requests">;
export type MediaStatus = "pending" | "approved" | "rejected" | "cancelled";

export function mediaStatus(value: string): MediaStatus {
  return value === "approved" || value === "rejected" || value === "cancelled" ? value : "pending";
}

export type PublicMedia = {
  userId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  skills: string[];
};

/** Schválená média na eventu (jen veřejné profily, bez kontaktů). */
export async function listEventMedia(eventId: string): Promise<PublicMedia[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.rpc("event_media_list", { p_event_id: eventId });
  const rows = data ?? [];
  const urls = await signFiles(
    supabase,
    AVATARS_BUCKET,
    rows.map((r) => r.avatar_path).filter((p): p is string => Boolean(p)),
  );
  return rows.map((r) => ({
    userId: r.user_id,
    username: r.username,
    name: r.display_name || r.username,
    avatarUrl: r.avatar_path ? (urls.get(r.avatar_path) ?? null) : null,
    skills: r.skills ?? [],
  }));
}

export type MediaContext = {
  email: string;
  isCreator: boolean;
  username: string | null;
  skills: string[];
  /** Poslední nezrušená žádost na tento event */
  request: MediaRequest | null;
};

/** Pro box „Média“ na eventu: kdo jsem a jestli už mám žádost. */
export async function getMediaContext(eventId: string): Promise<MediaContext | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [{ data: profile }, { data: requests }] = await Promise.all([
    supabase.from("profiles").select("is_creator, username, creator_skills").eq("id", auth.user.id).single(),
    supabase
      .from("event_media_requests")
      .select("*")
      .eq("event_id", eventId)
      .eq("user_id", auth.user.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  return {
    email: auth.user.email ?? "",
    isCreator: Boolean(profile?.is_creator),
    username: profile?.username ?? null,
    skills: profile?.creator_skills ?? [],
    request: requests?.[0] ?? null,
  };
}

export type OrganizerMediaRow = MediaRequest & {
  profile: { username: string | null; display_name: string | null; avatarUrl: string | null } | null;
};

/** Žádosti médií na event pro pořadatele (RLS pustí jen pořadatele). */
export async function listEventMediaRequests(eventId: string): Promise<OrganizerMediaRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("event_media_requests")
    .select("*, profile:profiles!event_media_requests_user_id_fkey(username, display_name, avatar_path)")
    .eq("event_id", eventId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });
  const rows = data ?? [];
  const urls = await signFiles(
    supabase,
    AVATARS_BUCKET,
    rows.map((r) => r.profile?.avatar_path).filter((p): p is string => Boolean(p)),
  );
  return rows.map(({ profile, ...r }) => ({
    ...r,
    profile: profile
      ? {
          username: profile.username,
          display_name: profile.display_name,
          avatarUrl: profile.avatar_path ? (urls.get(profile.avatar_path) ?? null) : null,
        }
      : null,
  }));
}

export type MyMediaRequest = MediaRequest & {
  event: { title: string; slug: string; starts_at: string; ends_at: string; timezone: string } | null;
};

/** Moje mediální žádosti (Moje registrace). */
export async function listMyMediaRequests(): Promise<MyMediaRequest[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data } = await supabase
    .from("event_media_requests")
    .select("*, event:events(title, slug, starts_at, ends_at, timezone)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
