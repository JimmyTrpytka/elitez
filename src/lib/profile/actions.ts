"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSocialFields } from "@/lib/social-links";
import { isSupportedCountry } from "@/lib/countries";
import { AVATARS_BUCKET } from "@/lib/storage";
import {
  LIMITS,
  emptyToNull,
  isValidUsername,
  normalizeUsername,
} from "@/lib/validation";

export type ProfileErrorKey =
  | "usernameInvalid"
  | "usernameTaken"
  | "displayNameTooLong"
  | "cityTooLong"
  | "bioTooLong"
  | "countryInvalid"
  | "socialInvalid"
  | "notSignedIn"
  | "generic";

export type ProfileFormState =
  | { status: "idle" }
  | { status: "error"; error: ProfileErrorKey; field?: string }
  | { status: "success" };

function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const username = normalizeUsername(text(formData, "username"));
  const displayName = emptyToNull(text(formData, "display_name"));
  const city = emptyToNull(text(formData, "city"));
  const bio = emptyToNull(text(formData, "bio"));
  const country = emptyToNull(text(formData, "country"));
  const visibility = text(formData, "visibility") === "private" ? "private" : "public";

  if (!isValidUsername(username)) return { status: "error", error: "usernameInvalid" };
  if (displayName && displayName.length > LIMITS.displayName)
    return { status: "error", error: "displayNameTooLong" };
  if (city && city.length > LIMITS.city) return { status: "error", error: "cityTooLong" };
  if (bio && bio.length > LIMITS.bio) return { status: "error", error: "bioTooLong" };
  if (country && !isSupportedCountry(country))
    return { status: "error", error: "countryInvalid" };
  const social = parseSocialFields(formData);
  if (!social.ok) return { status: "error", error: "socialInvalid", field: social.field };

  const supabase = await createClient();
  if (!supabase) return { status: "error", error: "generic" };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "error", error: "notSignedIn" };

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      display_name: displayName,
      city,
      bio,
      country,
      visibility,
      ...social.values,
    })
    .eq("id", auth.user.id);

  if (error) {
    // 23505 = porušení jedinečnosti → jméno už má někdo jiný
    if (error.code === "23505") return { status: "error", error: "usernameTaken" };
    return { status: "error", error: "generic" };
  }

  revalidatePath("/", "layout");
  return { status: "success" };
}

/**
 * Uloží nový avatar (soubor už nahrál prohlížeč do úložiště).
 * Cesta musí ležet ve složce přihlášeného uživatele. Starý soubor se smaže.
 */
export async function setAvatar(path: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };

  const prefix = `${auth.user.id}/`;
  if (!path.startsWith(prefix) || path.includes("..")) return { ok: false };

  const { data: current } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", auth.user.id)
    .single();

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", auth.user.id);
  if (error) return { ok: false };

  if (current?.avatar_path && current.avatar_path !== path) {
    await supabase.storage.from(AVATARS_BUCKET).remove([current.avatar_path]);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeAvatar(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };

  const { data: current } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", auth.user.id)
    .single();

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", auth.user.id);
  if (error) return { ok: false };

  if (current?.avatar_path) {
    await supabase.storage.from(AVATARS_BUCKET).remove([current.avatar_path]);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
