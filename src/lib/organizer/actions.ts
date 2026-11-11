"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Constants } from "@/lib/supabase/database.types";
import type { Enums, TablesInsert } from "@/lib/supabase/database.types";
import { createClient, type TypedSupabaseClient } from "@/lib/supabase/server";
import { isSupportedCountry } from "@/lib/countries";
import { DEFAULT_EVENT_TZ, zonedLocalToUtc } from "@/lib/dates";
import { EVENT_IMAGES_BUCKET, eventImagePath } from "@/lib/storage";
import { eventSlug, isValidSlug } from "@/lib/slug";
import { emptyToNull, parseIntInRange } from "@/lib/validation";

const UUID = /^[0-9a-f-]{36}$/i;
const SIZES = ["sm", "md", "lg"] as const;
const HEAD_START_HOURS = [0, 24, 72, 168, 720] as const;

export type ActionResult = { ok: true } | { ok: false; error: string };

function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

function localeOf(value: string) {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

/** Přihlášený uživatel + jeho schválený pořadatelský účet. */
async function requireOrganizer(): Promise<{
  supabase: TypedSupabaseClient;
  organizerId: string;
} | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("organizers")
    .select("id")
    .eq("profile_id", auth.user.id)
    .eq("status", "approved")
    .maybeSingle();
  return data ? { supabase, organizerId: data.id } : null;
}

function refresh() {
  revalidatePath("/", "layout");
}

/** Vloží event; při kolizi adresy (slug) zkusí -2, -3, … */
async function insertWithUniqueSlug(
  supabase: TypedSupabaseClient,
  values: TablesInsert<"events">,
): Promise<{ id: string } | { error: "slugTaken" | "generic" }> {
  const base = values.slug;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const slug =
      attempt === 1
        ? base
        : attempt < 6
          ? `${base}-${attempt}`
          : `${base}-${crypto.randomUUID().slice(0, 6)}`;
    const { data, error } = await supabase
      .from("events")
      .insert({ ...values, slug })
      .select("id")
      .single();
    if (!error && data) return { id: data.id };
    if (error?.code !== "23505") return { error: "generic" };
  }
  return { error: "slugTaken" };
}

// ---------------------------------------------------------------------
// Sezóny
// ---------------------------------------------------------------------

export type SeasonFormState =
  | { status: "idle" }
  | { status: "error"; error: "nameRequired" | "yearInvalid" | "notAllowed" | "generic" };

export async function createSeason(
  _prev: SeasonFormState,
  formData: FormData,
): Promise<SeasonFormState> {
  const locale = localeOf(text(formData, "locale"));
  const name = text(formData, "name").trim();
  const year = parseIntInRange(text(formData, "year"), 2000, 2100);
  if (!name || name.length > 80) return { status: "error", error: "nameRequired" };
  if (!year) return { status: "error", error: "yearInvalid" };

  const ctx = await requireOrganizer();
  if (!ctx) return { status: "error", error: "notAllowed" };
  const { data, error } = await ctx.supabase
    .from("seasons")
    .insert({ organizer_id: ctx.organizerId, name, year })
    .select("id")
    .single();
  if (error || !data) return { status: "error", error: "generic" };
  refresh();
  redirect(`/${locale}/organizer/seasons/${data.id}`);
}

/** Hromadné založení: řádky „název + datum“ → koncepty eventů v sezóně. */
export async function bulkCreateEvents(
  seasonId: string,
  rows: Array<{ title: string; date: string }>,
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const ctx = await requireOrganizer();
  if (!ctx || !UUID.test(seasonId)) return { ok: false, error: "notAllowed" };

  const valid = rows
    .map((r) => ({ title: r.title.trim(), date: r.date.trim() }))
    .filter((r) => r.title && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    .slice(0, 30);
  if (valid.length === 0) return { ok: false, error: "empty" };

  let created = 0;
  for (const row of valid) {
    const starts = zonedLocalToUtc(`${row.date}T10:00`);
    const ends = zonedLocalToUtc(`${row.date}T18:00`);
    if (!starts || !ends) continue;
    const result = await insertWithUniqueSlug(ctx.supabase, {
      organizer_id: ctx.organizerId,
      season_id: seasonId,
      title: row.title.slice(0, 120),
      slug: eventSlug(row.title, Number(row.date.slice(0, 4))),
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      country: "CZ",
      status: "draft",
    });
    if ("id" in result) created += 1;
  }
  refresh();
  return { ok: true, created };
}

// ---------------------------------------------------------------------
// Event – vytvoření a úprava
// ---------------------------------------------------------------------

export type EventErrorKey =
  | "titleRequired"
  | "startInvalid"
  | "endBeforeStart"
  | "registrationOrder"
  | "registrationAfterStart"
  | "slugInvalid"
  | "slugTaken"
  | "capacityInvalid"
  | "locationInvalid"
  | "countryInvalid"
  | "tooLong"
  | "notAllowed"
  | "generic";

export type EventFormState = { status: "idle" } | { status: "error"; error: EventErrorKey };

function optionalDate(value: string): string | null | undefined {
  if (!value.trim()) return null;
  const d = zonedLocalToUtc(value, DEFAULT_EVENT_TZ);
  return d ? d.toISOString() : undefined;
}

function optionalCoord(value: string, limit: number): number | null | undefined {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : undefined;
}

export async function saveEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const locale = localeOf(text(formData, "locale"));
  const id = text(formData, "id");
  const title = text(formData, "title").trim();
  const startsAt = optionalDate(text(formData, "starts_at"));
  const endsAt = optionalDate(text(formData, "ends_at"));
  const opensAt = optionalDate(text(formData, "registration_opens_at"));
  const closesAt = optionalDate(text(formData, "registration_closes_at"));
  const capacity = parseIntInRange(text(formData, "capacity"), 1, 100000);
  const lat = optionalCoord(text(formData, "lat"), 90);
  const lng = optionalCoord(text(formData, "lng"), 180);
  const country = emptyToNull(text(formData, "country"));
  const headStart = Number(text(formData, "verified_head_start_hours"));
  const accessValue = text(formData, "access");
  const access = (Constants.public.Enums.event_access as readonly string[]).includes(accessValue)
    ? (accessValue as Enums<"event_access">)
    : "public";
  const categoryValue = text(formData, "category");
  const category = (Constants.public.Enums.event_category as readonly string[]).includes(
    categoryValue,
  )
    ? (categoryValue as Enums<"event_category">)
    : "mix";
  const seasonId = emptyToNull(text(formData, "season_id"));
  const longTexts = {
    description: emptyToNull(text(formData, "description")),
    program: emptyToNull(text(formData, "program")),
    rules: emptyToNull(text(formData, "rules")),
    selection_criteria: emptyToNull(text(formData, "selection_criteria")),
  };

  if (!title || title.length > 120) return { status: "error", error: "titleRequired" };
  if (!startsAt || !endsAt) return { status: "error", error: "startInvalid" };
  if (endsAt < startsAt) return { status: "error", error: "endBeforeStart" };
  if (opensAt === undefined || closesAt === undefined)
    return { status: "error", error: "registrationOrder" };
  if (opensAt && closesAt && closesAt <= opensAt)
    return { status: "error", error: "registrationOrder" };
  // Přihlašovat se dá jen do začátku eventu
  if ((opensAt && opensAt >= startsAt) || (closesAt && closesAt > startsAt))
    return { status: "error", error: "registrationAfterStart" };
  if (capacity === undefined) return { status: "error", error: "capacityInvalid" };
  if (lat === undefined || lng === undefined || (lat === null) !== (lng === null))
    return { status: "error", error: "locationInvalid" };
  if (country && !isSupportedCountry(country))
    return { status: "error", error: "countryInvalid" };
  if (Object.values(longTexts).some((v) => (v?.length ?? 0) > 5000))
    return { status: "error", error: "tooLong" };
  if (seasonId && !UUID.test(seasonId)) return { status: "error", error: "notAllowed" };

  const ctx = await requireOrganizer();
  if (!ctx) return { status: "error", error: "notAllowed" };

  const slugInput = text(formData, "slug").trim().toLowerCase();
  const slug = slugInput || eventSlug(title, new Date(startsAt).getUTCFullYear());
  if (!isValidSlug(slug)) return { status: "error", error: "slugInvalid" };

  const values = {
    title,
    slug,
    season_id: seasonId,
    starts_at: startsAt,
    ends_at: endsAt,
    venue_name: emptyToNull(text(formData, "venue_name"))?.slice(0, 120) ?? null,
    venue_address: emptyToNull(text(formData, "venue_address"))?.slice(0, 200) ?? null,
    lat,
    lng,
    country,
    category,
    capacity,
    access,
    verified_priority: formData.get("verified_priority") === "on",
    verified_head_start_hours: (HEAD_START_HOURS as readonly number[]).includes(headStart)
      ? headStart
      : 0,
    registration_opens_at: opensAt,
    registration_closes_at: closesAt,
    ...longTexts,
  };

  let eventId = id;
  if (id) {
    if (!UUID.test(id)) return { status: "error", error: "notAllowed" };
    const { data, error } = await ctx.supabase
      .from("events")
      .update(values)
      .eq("id", id)
      .select("id");
    if (error?.code === "23505") return { status: "error", error: "slugTaken" };
    if (error) return { status: "error", error: "generic" };
    if (!data?.length) return { status: "error", error: "notAllowed" };
  } else {
    const result = await insertWithUniqueSlug(ctx.supabase, {
      ...values,
      organizer_id: ctx.organizerId,
      status: "draft",
    });
    if ("error" in result) return { status: "error", error: result.error };
    eventId = result.id;
  }

  refresh();
  redirect(`/${locale}/organizer/events/${eventId}`);
}

// ---------------------------------------------------------------------
// Stav, duplikace, smazání
// ---------------------------------------------------------------------

export async function setEventStatus(
  eventId: string,
  status: Enums<"event_status">,
): Promise<ActionResult> {
  const ctx = await requireOrganizer();
  if (!ctx || !UUID.test(eventId)) return { ok: false, error: "notAllowed" };
  if (!(Constants.public.Enums.event_status as readonly string[]).includes(status))
    return { ok: false, error: "notAllowed" };
  const { data, error } = await ctx.supabase
    .from("events")
    .update({ status })
    .eq("id", eventId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "notAllowed" };
  refresh();
  return { ok: true };
}

/** Kopie eventu (včetně obrázku) jako nový koncept. */
export async function duplicateEvent(eventId: string, localeValue: string): Promise<ActionResult> {
  const ctx = await requireOrganizer();
  if (!ctx || !UUID.test(eventId)) return { ok: false, error: "notAllowed" };
  const { data: source } = await ctx.supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("organizer_id", ctx.organizerId)
    .maybeSingle();
  if (!source) return { ok: false, error: "notAllowed" };

  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    published_at: _p,
    registration_verified_opens_at: _r,
    cover_path,
    cover_format,
    ...rest
  } = source;
  void [_id, _c, _u, _p, _r];

  const result = await insertWithUniqueSlug(ctx.supabase, {
    ...rest,
    title: `${source.title} (kopie)`.slice(0, 120),
    slug: `${source.slug}-kopie`.slice(0, 74),
    status: "draft",
    cover_path: null,
    cover_format: null,
  });
  if ("error" in result) return { ok: false, error: result.error };

  // Zkopírovat obrázek do složky nového eventu
  if (cover_path && cover_format) {
    const imageId = crypto.randomUUID();
    const newPath = `${result.id}/${imageId}`;
    let copied = true;
    for (const size of SIZES) {
      const { error } = await ctx.supabase.storage
        .from(EVENT_IMAGES_BUCKET)
        .copy(
          eventImagePath(cover_path, size, cover_format),
          eventImagePath(newPath, size, cover_format),
        );
      if (error) copied = false;
    }
    if (copied) {
      await ctx.supabase
        .from("events")
        .update({ cover_path: newPath, cover_format })
        .eq("id", result.id);
    }
  }

  refresh();
  redirect(`/${localeOf(localeValue)}/organizer/events/${result.id}`);
}

export async function deleteDraftEvent(eventId: string, localeValue: string): Promise<ActionResult> {
  const ctx = await requireOrganizer();
  if (!ctx || !UUID.test(eventId)) return { ok: false, error: "notAllowed" };
  const { data: event } = await ctx.supabase
    .from("events")
    .select("id, status, season_id, cover_path, cover_format")
    .eq("id", eventId)
    .eq("organizer_id", ctx.organizerId)
    .maybeSingle();
  if (!event) return { ok: false, error: "notAllowed" };
  if (event.status !== "draft") return { ok: false, error: "onlyDrafts" };

  if (event.cover_path && event.cover_format) {
    await ctx.supabase.storage
      .from(EVENT_IMAGES_BUCKET)
      .remove(SIZES.map((s) => eventImagePath(event.cover_path!, s, event.cover_format!)));
  }
  const { data, error } = await ctx.supabase.from("events").delete().eq("id", eventId).select("id");
  if (error || !data?.length) return { ok: false, error: "notAllowed" };

  refresh();
  const locale = localeOf(localeValue);
  redirect(
    event.season_id ? `/${locale}/organizer/seasons/${event.season_id}` : `/${locale}/organizer`,
  );
}

// ---------------------------------------------------------------------
// Obrázek eventu
// ---------------------------------------------------------------------

/** Uloží nový obrázek (soubory už nahrál prohlížeč) a smaže starý. */
export async function setEventCover(input: {
  eventId: string;
  imageId: string;
  format: string;
}): Promise<ActionResult> {
  const ctx = await requireOrganizer();
  if (!ctx || !UUID.test(input.eventId) || !UUID.test(input.imageId))
    return { ok: false, error: "notAllowed" };
  const format = input.format === "jpg" ? "jpg" : "webp";
  const { data: current } = await ctx.supabase
    .from("events")
    .select("cover_path, cover_format")
    .eq("id", input.eventId)
    .eq("organizer_id", ctx.organizerId)
    .maybeSingle();
  if (!current) return { ok: false, error: "notAllowed" };

  const { error } = await ctx.supabase
    .from("events")
    .update({ cover_path: `${input.eventId}/${input.imageId}`, cover_format: format })
    .eq("id", input.eventId);
  if (error) return { ok: false, error: "notAllowed" };

  if (current.cover_path && current.cover_format) {
    await ctx.supabase.storage
      .from(EVENT_IMAGES_BUCKET)
      .remove(SIZES.map((s) => eventImagePath(current.cover_path!, s, current.cover_format!)));
  }
  refresh();
  return { ok: true };
}

export async function removeEventCover(eventId: string): Promise<ActionResult> {
  const ctx = await requireOrganizer();
  if (!ctx || !UUID.test(eventId)) return { ok: false, error: "notAllowed" };
  const { data: current } = await ctx.supabase
    .from("events")
    .select("cover_path, cover_format")
    .eq("id", eventId)
    .eq("organizer_id", ctx.organizerId)
    .maybeSingle();
  if (!current) return { ok: false, error: "notAllowed" };
  await ctx.supabase
    .from("events")
    .update({ cover_path: null, cover_format: null })
    .eq("id", eventId);
  if (current.cover_path && current.cover_format) {
    await ctx.supabase.storage
      .from(EVENT_IMAGES_BUCKET)
      .remove(SIZES.map((s) => eventImagePath(current.cover_path!, s, current.cover_format!)));
  }
  refresh();
  return { ok: true };
}
