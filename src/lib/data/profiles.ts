import { createClient, type TypedSupabaseClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { AVATARS_BUCKET, signFiles } from "@/lib/storage";

export type Profile = Tables<"profiles">;
export type ProfileView = Profile & { avatarUrl: string | null };

async function withAvatar(
  supabase: TypedSupabaseClient,
  profile: Profile,
): Promise<ProfileView> {
  if (!profile.avatar_path) return { ...profile, avatarUrl: null };
  const urls = await signFiles(supabase, AVATARS_BUCKET, [profile.avatar_path]);
  return { ...profile, avatarUrl: urls.get(profile.avatar_path) ?? null };
}

/** Profil přihlášeného uživatele (nebo null, když nikdo není přihlášený). */
export async function getMyProfile(): Promise<ProfileView | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();
  return data ? withAvatar(supabase, data) : null;
}

/** Profil podle uživatelského jména. RLS vrátí soukromý profil jen majiteli. */
export async function getProfileByUsername(
  username: string,
): Promise<ProfileView | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return data ? withAvatar(supabase, data) : null;
}
