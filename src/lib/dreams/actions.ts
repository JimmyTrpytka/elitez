"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Constants } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { DREAM_PHOTOS_BUCKET, dreamPhotoPath } from "@/lib/storage";
import { LIMITS, emptyToNull, parseIntInRange } from "@/lib/validation";

/** Chyby jako klíče do překladů `Dreams.errors`. */
export type DreamErrorKey =
  | "makeRequired"
  | "modelRequired"
  | "tooLong"
  | "yearInvalid"
  | "yearOrder"
  | "usernameRequired"
  | "limit"
  | "ownVehicle"
  | "notAllowed"
  | "generic";

export type DreamFormState = { status: "idle" } | { status: "error"; error: DreamErrorKey };
export type DreamResult = { ok: true } | { ok: false; error: DreamErrorKey };

const UUID = /^[0-9a-f-]{36}$/i;
const NOTE_MAX = 500;

function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { supabase, userId: data.user.id };
}

function refresh() {
  revalidatePath("/", "layout");
}

function dbError(message: string | undefined): DreamErrorKey {
  if (message?.includes("dream_limit")) return "limit";
  if (message?.includes("row-level security")) return "notAllowed";
  return "generic";
}

/** Vytvoření / úprava snu z formuláře. */
export async function saveDream(_prev: DreamFormState, formData: FormData): Promise<DreamFormState> {
  const localeValue = text(formData, "locale");
  const locale = hasLocale(routing.locales, localeValue) ? localeValue : routing.defaultLocale;
  const id = text(formData, "id");
  const make = text(formData, "make").trim();
  const model = text(formData, "model").trim();
  const note = emptyToNull(text(formData, "note"));
  const maxYear = new Date().getFullYear() + 1;
  const yearFrom = parseIntInRange(text(formData, "year_from"), 1885, maxYear);
  const yearTo = parseIntInRange(text(formData, "year_to"), 1885, maxYear);
  const statusValue = text(formData, "status");
  const status = (Constants.public.Enums.dream_status as readonly string[]).includes(statusValue)
    ? (statusValue as (typeof Constants.public.Enums.dream_status)[number])
    : "dreaming";
  const visibility = text(formData, "visibility") === "private" ? "private" : "public";

  if (!make) return { status: "error", error: "makeRequired" };
  if (!model) return { status: "error", error: "modelRequired" };
  if (make.length > LIMITS.make || model.length > LIMITS.model || (note?.length ?? 0) > NOTE_MAX)
    return { status: "error", error: "tooLong" };
  if (yearFrom === undefined || yearTo === undefined) return { status: "error", error: "yearInvalid" };
  if (yearFrom && yearTo && yearTo < yearFrom) return { status: "error", error: "yearOrder" };

  const ctx = await requireUser();
  if (!ctx) return { status: "error", error: "notAllowed" };
  const { supabase, userId } = ctx;
  const values = { make, model, note, status, visibility, year_from: yearFrom, year_to: yearTo } as const;

  let dreamId = id;
  if (id) {
    if (!UUID.test(id)) return { status: "error", error: "notAllowed" };
    const { data, error } = await supabase.from("dream_cars").update(values).eq("id", id).select("id");
    if (error) return { status: "error", error: dbError(error.message) };
    if (!data?.length) return { status: "error", error: "notAllowed" };
  } else {
    const { data: profile } = await supabase.from("profiles").select("username").eq("id", userId).single();
    if (!profile?.username) return { status: "error", error: "usernameRequired" };
    const { data, error } = await supabase
      .from("dream_cars")
      .insert({ ...values, owner_id: userId })
      .select("id")
      .single();
    if (error || !data) return { status: "error", error: dbError(error?.message) };
    dreamId = data.id;
  }

  refresh();
  // Po založení rovnou na úpravu – tam jde přidat fotka
  redirect(id ? `/${locale}/garage/dreams` : `/${locale}/garage/dreams/${dreamId}/edit?created=1`);
}

/** Smazání snu včetně vlastní fotky. */
export async function deleteDream(dreamId: string, localeValue: string): Promise<DreamResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(dreamId)) return { ok: false, error: "notAllowed" };
  const { data: dream } = await ctx.supabase
    .from("dream_cars")
    .select("id, owner_id, photo_key, photo_format")
    .eq("id", dreamId)
    .eq("owner_id", ctx.userId)
    .maybeSingle();
  if (!dream) return { ok: false, error: "notAllowed" };
  await removePhotoFiles(ctx.supabase, dream);
  const { error } = await ctx.supabase.from("dream_cars").delete().eq("id", dreamId);
  if (error) return { ok: false, error: "generic" };
  refresh();
  const locale = hasLocale(routing.locales, localeValue) ? localeValue : routing.defaultLocale;
  redirect(`/${locale}/garage/dreams`);
}

type PhotoRef = { id: string; owner_id: string; photo_key: string | null; photo_format: string | null };

async function removePhotoFiles(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, d: PhotoRef) {
  if (!d.photo_key || !d.photo_format) return;
  await supabase.storage
    .from(DREAM_PHOTOS_BUCKET)
    .remove((["sm", "md", "lg"] as const).map((s) => dreamPhotoPath(d.owner_id, d.id, d.photo_key!, s, d.photo_format!)));
}

/** Zapíše fotku, kterou prohlížeč nahrál do úložiště; starou smaže. */
export async function setDreamPhoto(input: {
  dreamId: string;
  photoKey: string;
  format: string;
}): Promise<DreamResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(input.dreamId) || !UUID.test(input.photoKey)) return { ok: false, error: "notAllowed" };
  const { data: dream } = await ctx.supabase
    .from("dream_cars")
    .select("id, owner_id, photo_key, photo_format")
    .eq("id", input.dreamId)
    .eq("owner_id", ctx.userId)
    .maybeSingle();
  if (!dream) return { ok: false, error: "notAllowed" };
  const { error } = await ctx.supabase
    .from("dream_cars")
    .update({ photo_key: input.photoKey, photo_format: input.format === "jpg" ? "jpg" : "webp" })
    .eq("id", input.dreamId);
  if (error) return { ok: false, error: "generic" };
  await removePhotoFiles(ctx.supabase, dream);
  refresh();
  return { ok: true };
}

export async function removeDreamPhoto(dreamId: string): Promise<DreamResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(dreamId)) return { ok: false, error: "notAllowed" };
  const { data: dream } = await ctx.supabase
    .from("dream_cars")
    .select("id, owner_id, photo_key, photo_format")
    .eq("id", dreamId)
    .eq("owner_id", ctx.userId)
    .maybeSingle();
  if (!dream) return { ok: false, error: "notAllowed" };
  const { error } = await ctx.supabase
    .from("dream_cars")
    .update({ photo_key: null, photo_format: null })
    .eq("id", dreamId);
  if (error) return { ok: false, error: "generic" };
  await removePhotoFiles(ctx.supabase, dream);
  refresh();
  return { ok: true };
}

export type WantResult =
  | { ok: true; wanted: boolean; dreamers: number }
  | { ok: false; error: DreamErrorKey };

/**
 * „Tohle chci!“ – přidá auto jiného člena do Garáže snů (nebo ho odebere).
 * Značku, model a rok převezme z auta; databáze hlídá, že je auto vidět a není vlastní.
 */
export async function toggleWantVehicle(vehicleId: string): Promise<WantResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(vehicleId)) return { ok: false, error: "notAllowed" };
  const { supabase, userId } = ctx;

  const { data: existing } = await supabase
    .from("dream_cars")
    .select("id, owner_id, photo_key, photo_format")
    .eq("owner_id", userId)
    .eq("linked_vehicle_id", vehicleId)
    .maybeSingle();

  let wanted: boolean;
  if (existing) {
    await removePhotoFiles(supabase, existing);
    const { error } = await supabase.from("dream_cars").delete().eq("id", existing.id);
    if (error) return { ok: false, error: "generic" };
    wanted = false;
  } else {
    const [{ data: profile }, { data: vehicle }] = await Promise.all([
      supabase.from("profiles").select("username").eq("id", userId).single(),
      supabase.from("vehicles").select("id, owner_id, make, model, year").eq("id", vehicleId).maybeSingle(),
    ]);
    if (!profile?.username) return { ok: false, error: "usernameRequired" };
    if (!vehicle) return { ok: false, error: "notAllowed" };
    if (vehicle.owner_id === userId) return { ok: false, error: "ownVehicle" };
    const { error } = await supabase.from("dream_cars").insert({
      owner_id: userId,
      make: vehicle.make,
      model: vehicle.model,
      year_from: vehicle.year,
      year_to: vehicle.year,
      linked_vehicle_id: vehicle.id,
    });
    if (error) return { ok: false, error: dbError(error.message) };
    wanted = true;
  }

  const { data: stats } = await supabase.rpc("vehicle_social_stats", { p_vehicle_ids: [vehicleId] });
  refresh();
  return { ok: true, wanted, dreamers: stats?.[0]?.dreamers ?? 0 };
}
