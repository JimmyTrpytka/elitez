"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Constants } from "@/lib/supabase/database.types";
import type { Enums, TablesInsert } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { isSupportedCountry } from "@/lib/countries";
import { VEHICLE_PHOTOS_BUCKET, vehiclePhotoPath } from "@/lib/storage";
import { LIMITS, emptyToNull, parseIntInRange } from "@/lib/validation";

// ---------------------------------------------------------------------
// Společné
// ---------------------------------------------------------------------

export type VehicleErrorKey =
  | "makeRequired"
  | "modelRequired"
  | "tooLong"
  | "yearInvalid"
  | "powerInvalid"
  | "categoryInvalid"
  | "countryInvalid"
  | "dateInvalid"
  | "usernameRequired"
  | "notAllowed"
  | "generic";

export type VehicleFormState =
  | { status: "idle" }
  | { status: "error"; error: VehicleErrorKey };

export type ActionResult = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { supabase, userId: data.user.id };
}

/** Po změně načte stránky znovu (garáž, profil, detail vozidla). */
function refreshGarage() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------
// Vozidlo – vytvoření a úprava
// ---------------------------------------------------------------------

export async function saveVehicle(
  _prev: VehicleFormState,
  formData: FormData,
): Promise<VehicleFormState> {
  const localeValue = text(formData, "locale");
  const locale = hasLocale(routing.locales, localeValue)
    ? localeValue
    : routing.defaultLocale;
  const id = text(formData, "id");

  const type = oneOf(text(formData, "type"), Constants.public.Enums.vehicle_type);
  const category = oneOf(
    text(formData, "category"),
    Constants.public.Enums.vehicle_category,
  );
  const make = text(formData, "make").trim();
  const model = text(formData, "model").trim();
  const engine = emptyToNull(text(formData, "engine"));
  const description = emptyToNull(text(formData, "description"));
  const story = emptyToNull(text(formData, "story"));
  const country = emptyToNull(text(formData, "country"));
  const acquiredOn = emptyToNull(text(formData, "acquired_on"));
  const visibility = text(formData, "visibility") === "private" ? "private" : "public";
  const year = parseIntInRange(text(formData, "year"), 1885, new Date().getFullYear() + 1);
  const power = parseIntInRange(text(formData, "power_hp"), 1, 5000);

  if (!type || !category) return { status: "error", error: "categoryInvalid" };
  if (!make) return { status: "error", error: "makeRequired" };
  if (!model) return { status: "error", error: "modelRequired" };
  if (
    make.length > LIMITS.make ||
    model.length > LIMITS.model ||
    (engine?.length ?? 0) > LIMITS.engine ||
    (description?.length ?? 0) > LIMITS.description ||
    (story?.length ?? 0) > LIMITS.story
  )
    return { status: "error", error: "tooLong" };
  if (year === undefined) return { status: "error", error: "yearInvalid" };
  if (power === undefined) return { status: "error", error: "powerInvalid" };
  if (country && !isSupportedCountry(country))
    return { status: "error", error: "countryInvalid" };
  if (acquiredOn && !DATE.test(acquiredOn))
    return { status: "error", error: "dateInvalid" };

  const ctx = await requireUser();
  if (!ctx) return { status: "error", error: "notAllowed" };
  const { supabase, userId } = ctx;

  const values = {
    type,
    category,
    make,
    model,
    year,
    engine,
    power_hp: power,
    description,
    story,
    country,
    visibility,
    acquired_on: acquiredOn,
  } satisfies Partial<TablesInsert<"vehicles">>;

  let vehicleId = id;
  if (id) {
    if (!UUID.test(id)) return { status: "error", error: "notAllowed" };
    const { data, error } = await supabase
      .from("vehicles")
      .update(values)
      .eq("id", id)
      .select("id");
    if (error) return { status: "error", error: "generic" };
    if (!data || data.length === 0) return { status: "error", error: "notAllowed" };
  } else {
    // Garáž jde založit až s uživatelským jménem (kvůli veřejné adrese profilu)
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();
    if (!profile?.username) return { status: "error", error: "usernameRequired" };

    const { data, error } = await supabase
      .from("vehicles")
      .insert({ ...values, owner_id: userId })
      .select("id")
      .single();
    if (error || !data) return { status: "error", error: "generic" };
    vehicleId = data.id;
  }

  refreshGarage();
  redirect(`/${locale}/garage/${vehicleId}?saved=1`);
}

// ---------------------------------------------------------------------
// Viditelnost, prodej, návrat z archivu, smazání
// ---------------------------------------------------------------------

export async function setVehicleVisibility(
  vehicleId: string,
  visibility: Enums<"visibility">,
): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(vehicleId)) return { ok: false, error: "notAllowed" };
  const { data, error } = await ctx.supabase
    .from("vehicles")
    .update({ visibility: visibility === "private" ? "private" : "public" })
    .eq("id", vehicleId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "notAllowed" };
  refreshGarage();
  return { ok: true };
}

/** „Prodáno“ → přesun do archivu bývalých aut (nic se nemaže). */
export async function markVehicleSold(
  vehicleId: string,
  soldOn: string,
): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(vehicleId)) return { ok: false, error: "notAllowed" };
  const date = DATE.test(soldOn) ? soldOn : new Date().toISOString().slice(0, 10);
  const { data, error } = await ctx.supabase
    .from("vehicles")
    .update({ status: "former", sold_on: date })
    .eq("id", vehicleId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "notAllowed" };
  refreshGarage();
  return { ok: true };
}

/** Vrácení z archivu (např. omylem označeno jako prodané). */
export async function restoreVehicle(vehicleId: string): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(vehicleId)) return { ok: false, error: "notAllowed" };
  const { data, error } = await ctx.supabase
    .from("vehicles")
    .update({ status: "current", sold_on: null })
    .eq("id", vehicleId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "notAllowed" };
  refreshGarage();
  return { ok: true };
}

/**
 * Smazání vozidla – jen pokud nikdy nebylo na eventu (hlídá i databáze).
 * Nejdřív se smažou soubory fotek, pak záznam.
 */
export async function deleteVehicle(
  vehicleId: string,
  localeValue: string,
): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(vehicleId)) return { ok: false, error: "notAllowed" };
  const { supabase, userId } = ctx;

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, owner_id, vehicle_photos(id, format)")
    .eq("id", vehicleId)
    .maybeSingle();
  if (!vehicle || vehicle.owner_id !== userId) return { ok: false, error: "notAllowed" };

  const { data: hasHistory } = await supabase.rpc("vehicle_has_event_history", {
    p_vehicle_id: vehicleId,
  });
  if (hasHistory) return { ok: false, error: "hasEventHistory" };

  const paths = vehicle.vehicle_photos.flatMap((p) =>
    (["sm", "md", "lg"] as const).map((s) => vehiclePhotoPath(vehicleId, p.id, s, p.format)),
  );
  if (paths.length) await supabase.storage.from(VEHICLE_PHOTOS_BUCKET).remove(paths);

  const { data, error } = await supabase
    .from("vehicles")
    .delete()
    .eq("id", vehicleId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "notAllowed" };

  const locale = hasLocale(routing.locales, localeValue)
    ? localeValue
    : routing.defaultLocale;
  refreshGarage();
  redirect(`/${locale}/garage`);
}

// ---------------------------------------------------------------------
// Úpravy (modifikace)
// ---------------------------------------------------------------------

export async function addVehicleMod(
  vehicleId: string,
  category: string,
  description: string,
): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(vehicleId)) return { ok: false, error: "notAllowed" };
  const cat = oneOf(category, Constants.public.Enums.mod_category) ?? "other";
  const desc = description.trim();
  if (!desc || desc.length > LIMITS.modDescription) return { ok: false, error: "invalid" };

  const { count } = await ctx.supabase
    .from("vehicle_mods")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", vehicleId);

  const { error } = await ctx.supabase
    .from("vehicle_mods")
    .insert({ vehicle_id: vehicleId, category: cat, description: desc, position: count ?? 0 });
  if (error) return { ok: false, error: "notAllowed" };
  refreshGarage();
  return { ok: true };
}

export async function deleteVehicleMod(modId: string): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(modId)) return { ok: false, error: "notAllowed" };
  const { data, error } = await ctx.supabase
    .from("vehicle_mods")
    .delete()
    .eq("id", modId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "notAllowed" };
  refreshGarage();
  return { ok: true };
}

// ---------------------------------------------------------------------
// Fotky
// ---------------------------------------------------------------------

/** Zapíše fotku, kterou už prohlížeč nahrál do úložiště (3 velikosti). */
export async function addVehiclePhoto(input: {
  vehicleId: string;
  photoId: string;
  format: string;
  width: number;
  height: number;
}): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(input.vehicleId) || !UUID.test(input.photoId))
    return { ok: false, error: "notAllowed" };
  const format = input.format === "jpg" ? "jpg" : "webp";

  const { data: last } = await ctx.supabase
    .from("vehicle_photos")
    .select("position")
    .eq("vehicle_id", input.vehicleId)
    .order("position", { ascending: false })
    .limit(1);
  const position = (last?.[0]?.position ?? -1) + 1;

  const { error } = await ctx.supabase.from("vehicle_photos").insert({
    id: input.photoId,
    vehicle_id: input.vehicleId,
    format,
    width: Math.round(input.width) || null,
    height: Math.round(input.height) || null,
    position,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("photo_limit_reached") ? "photoLimit" : "notAllowed",
    };
  }
  refreshGarage();
  return { ok: true };
}

export async function deleteVehiclePhoto(photoId: string): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(photoId)) return { ok: false, error: "notAllowed" };
  const { data: photo } = await ctx.supabase
    .from("vehicle_photos")
    .select("id, vehicle_id, format")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return { ok: false, error: "notAllowed" };

  const { data, error } = await ctx.supabase
    .from("vehicle_photos")
    .delete()
    .eq("id", photoId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "notAllowed" };

  await ctx.supabase.storage
    .from(VEHICLE_PHOTOS_BUCKET)
    .remove(
      (["sm", "md", "lg"] as const).map((s) =>
        vehiclePhotoPath(photo.vehicle_id, photo.id, s, photo.format),
      ),
    );
  refreshGarage();
  return { ok: true };
}

/** Uloží nové pořadí fotek (první = hlavní fotka). */
export async function reorderVehiclePhotos(
  vehicleId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(vehicleId) || !orderedIds.every((id) => UUID.test(id)))
    return { ok: false, error: "notAllowed" };

  for (const [index, id] of orderedIds.entries()) {
    const { error } = await ctx.supabase
      .from("vehicle_photos")
      .update({ position: index })
      .eq("id", id)
      .eq("vehicle_id", vehicleId);
    if (error) return { ok: false, error: "notAllowed" };
  }
  refreshGarage();
  return { ok: true };
}
