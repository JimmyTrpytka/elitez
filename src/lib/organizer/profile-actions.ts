"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ORGANIZER_LOGOS_BUCKET, organizerLogoPath } from "@/lib/storage";
import { normalizeUrl } from "@/lib/url";
import { getCurrentOrganizerId } from "@/lib/organizer/current";

/** Chyby jako klíče do překladů `OrganizerProfile.errors`. */
export type OrganizerProfileError =
  | "nameRequired"
  | "tooLong"
  | "slugInvalid"
  | "slugTaken"
  | "urlInvalid"
  | "notAllowed"
  | "generic";

export type OrganizerProfileState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; error: OrganizerProfileError; field?: string };

const UUID = /^[0-9a-f-]{36}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

/** Pořadatelský účet přihlášeného (jen schválený). */
async function myOrganizer() {
  const supabase = await createClient();
  if (!supabase) return null;
  const id = await getCurrentOrganizerId();
  if (!id) return null;
  const { data } = await supabase
    .from("organizers")
    .select("id, logo_key, logo_format")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();
  return data ? { supabase, organizer: data } : null;
}

export async function saveOrganizerProfile(
  _prev: OrganizerProfileState,
  formData: FormData,
): Promise<OrganizerProfileState> {
  const name = text(formData, "name");
  const description = text(formData, "description") || null;
  const slug = text(formData, "slug").toLowerCase();
  const showPast = formData.get("show_past_events") === "on";

  if (!name) return { status: "error", error: "nameRequired", field: "name" };
  if (name.length > 80 || (description?.length ?? 0) > 2000) return { status: "error", error: "tooLong" };
  if (!SLUG.test(slug) || slug.length > 60) return { status: "error", error: "slugInvalid", field: "slug" };

  const urls: Record<"website_url" | "instagram_url" | "facebook_url", string | null> = {
    website_url: null,
    instagram_url: null,
    facebook_url: null,
  };
  for (const key of Object.keys(urls) as Array<keyof typeof urls>) {
    const normalized = normalizeUrl(text(formData, key));
    if (normalized === undefined) return { status: "error", error: "urlInvalid", field: key };
    urls[key] = normalized;
  }

  const ctx = await myOrganizer();
  if (!ctx) return { status: "error", error: "notAllowed" };
  const { error } = await ctx.supabase
    .from("organizers")
    .update({ name, description, slug, show_past_events: showPast, ...urls })
    .eq("id", ctx.organizer.id);
  if (error) {
    if (error.code === "23505") return { status: "error", error: "slugTaken", field: "slug" };
    return { status: "error", error: "generic" };
  }
  revalidatePath("/", "layout");
  return { status: "saved" };
}

async function removeLogoFiles(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  o: { id: string; logo_key: string | null; logo_format: string | null },
) {
  if (!o.logo_key || !o.logo_format) return;
  await supabase.storage
    .from(ORGANIZER_LOGOS_BUCKET)
    .remove((["sm", "md"] as const).map((s) => organizerLogoPath(o.id, o.logo_key!, s, o.logo_format!)));
}

/** Zapíše logo, které prohlížeč nahrál do úložiště; staré smaže. */
export async function setOrganizerLogo(input: { logoKey: string; format: string }): Promise<{ ok: boolean }> {
  const ctx = await myOrganizer();
  if (!ctx || !UUID.test(input.logoKey)) return { ok: false };
  const { error } = await ctx.supabase
    .from("organizers")
    .update({ logo_key: input.logoKey, logo_format: input.format === "jpg" ? "jpg" : "webp" })
    .eq("id", ctx.organizer.id);
  if (error) return { ok: false };
  await removeLogoFiles(ctx.supabase, ctx.organizer);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeOrganizerLogo(): Promise<{ ok: boolean }> {
  const ctx = await myOrganizer();
  if (!ctx) return { ok: false };
  const { error } = await ctx.supabase
    .from("organizers")
    .update({ logo_key: null, logo_format: null })
    .eq("id", ctx.organizer.id);
  if (error) return { ok: false };
  await removeLogoFiles(ctx.supabase, ctx.organizer);
  revalidatePath("/", "layout");
  return { ok: true };
}

export type CoOrganizerResult = { ok: true } | { ok: false; error: "notAllowed" | "userNotFound" | "alreadyMember" | "limit" | "generic" };

function coError(message: string | undefined): CoOrganizerResult {
  if (message === "not_allowed") return { ok: false, error: "notAllowed" };
  if (message === "user_not_found") return { ok: false, error: "userNotFound" };
  if (message === "already_member") return { ok: false, error: "alreadyMember" };
  if (message === "member_limit") return { ok: false, error: "limit" };
  return { ok: false, error: "generic" };
}

/** Přidá spolupořadatele (podle uživatelského jména) k právě spravovanému pořadateli. */
export async function addCoOrganizer(username: string): Promise<CoOrganizerResult> {
  const clean = username.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9._]{3,30}$/.test(clean)) return { ok: false, error: "userNotFound" };
  const supabase = await createClient();
  const id = await getCurrentOrganizerId();
  if (!supabase || !id) return { ok: false, error: "notAllowed" };
  const { error } = await supabase.rpc("add_organizer_member", { p_organizer_id: id, p_username: clean });
  if (error) return coError(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Odebere spolupořadatele (vlastník), nebo odejde sám. */
export async function removeCoOrganizer(userId: string): Promise<CoOrganizerResult> {
  if (!UUID.test(userId)) return { ok: false, error: "notAllowed" };
  const supabase = await createClient();
  const id = await getCurrentOrganizerId();
  if (!supabase || !id) return { ok: false, error: "notAllowed" };
  const { error } = await supabase.rpc("remove_organizer_member", { p_organizer_id: id, p_user_id: userId });
  if (error) return coError(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}
