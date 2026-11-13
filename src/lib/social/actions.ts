"use server";

import { createClient } from "@/lib/supabase/server";

/** Chyby vrací jako klíč do překladů `Social.errors`. */
export type SocialError =
  | "notAuthenticated"
  | "usernameRequired"
  | "ownContent"
  | "notFound"
  | "unknown";

function toError(message: string | undefined): SocialError {
  switch (message) {
    case "not_authenticated":
      return "notAuthenticated";
    case "username_required":
      return "usernameRequired";
    case "own_content":
      return "ownContent";
    case "not_found":
    case "invalid_target":
      return "notFound";
    default:
      return "unknown";
  }
}

export type TurboResult =
  | { ok: true; given: boolean; total: number }
  | { ok: false; error: SocialError };

/** Dá / odebere turbo fotce, garáži nebo práci v portfoliu. Vše kontroluje databáze (toggle_turbo). */
export async function toggleTurbo(
  target: { photoId: string } | { profileId: string } | { portfolioItemId: string },
): Promise<TurboResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unknown" };
  const { data, error } = await supabase.rpc("toggle_turbo", {
    p_photo_id: "photoId" in target ? target.photoId : undefined,
    p_profile_id: "profileId" in target ? target.profileId : undefined,
    p_portfolio_item_id: "portfolioItemId" in target ? target.portfolioItemId : undefined,
  });
  const row = data?.[0];
  if (error || !row) return { ok: false, error: toError(error?.message) };
  return { ok: true, given: row.given, total: row.total };
}

export type FollowResult =
  | { ok: true; following: boolean; followers: number }
  | { ok: false; error: SocialError };

/** Začne / přestane sledovat garáž. */
export async function toggleFollow(profileId: string): Promise<FollowResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unknown" };
  const { data, error } = await supabase.rpc("toggle_follow", { p_profile_id: profileId });
  const row = data?.[0];
  if (error || !row) return { ok: false, error: toError(error?.message) };
  return { ok: true, following: row.following, followers: row.followers };
}

/** Začne / přestane sledovat pořadatele (upozornění na jeho eventy). */
export async function toggleOrganizerFollow(organizerId: string): Promise<FollowResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unknown" };
  const { data, error } = await supabase.rpc("toggle_organizer_follow", { p_organizer_id: organizerId });
  const row = data?.[0];
  if (error || !row) return { ok: false, error: toError(error?.message) };
  return { ok: true, following: row.following, followers: row.followers };
}
