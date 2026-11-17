import { createClient, type TypedSupabaseClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/supabase/database.types";
import { AVATARS_BUCKET, VEHICLE_PHOTOS_BUCKET, vehiclePhotoPath } from "@/lib/storage";
import { signFiles } from "@/lib/storage-sign";
import { attendanceWindowOpen } from "@/lib/registration-window";

export type Registration = Tables<"event_registrations">;
export type RegistrationStatus = Enums<"registration_status">;

const UUID = /^[0-9a-f-]{36}$/i;

type PhotoRow = { id: string; vehicle_id: string; position: number; format: string; created_at: string };

function firstPhoto(photos: PhotoRow[] | null | undefined): PhotoRow | null {
  if (!photos?.length) return null;
  return [...photos].sort(
    (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
  )[0];
}

async function currentUserId(supabase: TypedSupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ---------------------------------------------------------------------
// Uchazeč
// ---------------------------------------------------------------------

export type RegistrationFormContext = {
  userId: string;
  email: string;
  /** Telefon z poslední přihlášky (předvyplnění) */
  lastPhone: string | null;
  username: string | null;
  isVerified: boolean;
  profilePrivate: boolean;
  vehicles: Array<{
    id: string;
    make: string;
    model: string;
    year: number | null;
    visibility: "public" | "private";
    photoCount: number;
    coverUrl: string | null;
  }>;
};

/** Údaje pro formulář přihlášky (vozidla z garáže s fotkou, e-mail, telefon, Verified). */
export async function getRegistrationFormContext(): Promise<RegistrationFormContext | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [{ data: profile }, { data: vehicles }, { data: last }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, verified_at, visibility")
      .eq("id", auth.user.id)
      .single(),
    supabase
      .from("vehicles")
      .select("id, make, model, year, visibility, vehicle_photos(id, vehicle_id, position, format, created_at)")
      .eq("owner_id", auth.user.id)
      .eq("status", "current")
      .order("created_at", { ascending: false }),
    supabase
      .from("event_registrations")
      .select("contact_phone")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const rows = vehicles ?? [];
  const covers = rows.map((v) => firstPhoto(v.vehicle_photos));
  const paths = covers
    .filter((c): c is PhotoRow => Boolean(c))
    .map((c) => vehiclePhotoPath(c.vehicle_id, c.id, "sm", c.format));
  const urls = await signFiles(supabase, VEHICLE_PHOTOS_BUCKET, paths);
  return {
    userId: auth.user.id,
    email: auth.user.email ?? "",
    lastPhone: last?.contact_phone ?? null,
    username: profile?.username ?? null,
    isVerified: Boolean(profile?.verified_at),
    profilePrivate: profile?.visibility === "private",
    vehicles: rows.map((v, i) => {
      const c = covers[i];
      return {
        id: v.id,
        make: v.make,
        model: v.model,
        year: v.year,
        visibility: v.visibility,
        photoCount: v.vehicle_photos.length,
        coverUrl: c ? (urls.get(vehiclePhotoPath(c.vehicle_id, c.id, "sm", c.format)) ?? null) : null,
      };
    }),
  };
}

/** Informace pro schválené účastníky (RLS: jen schválený účastník nebo pořadatel). */
export async function getParticipantInfo(eventId: string): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("event_participant_info")
    .select("body")
    .eq("event_id", eventId)
    .maybeSingle();
  return data?.body ?? null;
}

export type MyEventRegistration = Registration & {
  vehicle: { id: string; make: string; model: string } | null;
};

/** Moje přihlášky na konkrétní event. */
export async function getMyRegistrationsForEvent(eventId: string): Promise<MyEventRegistration[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const uid = await currentUserId(supabase);
  if (!uid) return [];
  const { data } = await supabase
    .from("event_registrations")
    .select("*, vehicle:vehicles(id, make, model)")
    .eq("event_id", eventId)
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type MyRegistrationView = Registration & {
  vehicle: { id: string; make: string; model: string } | null;
  event: {
    id: string;
    slug: string;
    title: string;
    starts_at: string;
    ends_at: string;
    timezone: string;
    status: Enums<"event_status">;
    confirm_days_before: number | null;
  } | null;
  /** Je otevřené potvrzení účasti (schválená přihláška)? */
  attendanceOpen: boolean;
  /** Lze přihlášku ještě zrušit (aktivní stav a event nezačal)? */
  canCancel: boolean;
  /** Lze ještě upravit telefon, e-mail a zprávu (čeká / čekací listina)? */
  canEdit: boolean;
};

/** Všechny moje přihlášky (Moje registrace). */
export async function listMyRegistrations(): Promise<MyRegistrationView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const uid = await currentUserId(supabase);
  if (!uid) return [];
  const { data } = await supabase
    .from("event_registrations")
    .select(
      "*, vehicle:vehicles(id, make, model), event:events(id, slug, title, starts_at, ends_at, timezone, status, confirm_days_before)",
    )
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  const now = Date.now();
  return (data ?? []).map((r) => {
    const upcoming = Boolean(r.event) && new Date(r.event!.starts_at).getTime() > now;
    return {
      ...r,
      canCancel: ["pending", "approved", "waitlist"].includes(r.status) && upcoming,
      canEdit: ["pending", "waitlist"].includes(r.status) && upcoming,
      attendanceOpen:
        r.status === "approved" &&
        Boolean(r.event) &&
        attendanceWindowOpen(r.event!.starts_at, r.event!.confirm_days_before, now),
    };
  });
}

// ---------------------------------------------------------------------
// Pořadatel
// ---------------------------------------------------------------------

/** Interní hodnocení a koncept rozhodnutí (vidí jen pořadatel). */
export type RegistrationReview = {
  rating: number | null;
  draft_status: RegistrationStatus | null;
  draft_reason: Enums<"rejection_reason"> | null;
  draft_message: string | null;
};

export type OrganizerRegistrationRow = Registration & {
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number | null;
    category: Enums<"vehicle_category">;
    visibility: "public" | "private";
  } | null;
  applicant: {
    id: string;
    username: string | null;
    display_name: string | null;
    verified_at: string | null;
  } | null;
  coverUrl: string | null;
  rating: number | null;
  /** Neodeslané rozhodnutí (u eventu s „odeslat najednou“) */
  draftStatus: RegistrationStatus | null;
  /** Stav, jak ho vidí pořadatel: koncept, jinak skutečný stav */
  effectiveStatus: RegistrationStatus;
};

export type RegistrationCounts = Record<RegistrationStatus, number>;

export type RegistrationSort = "time" | "rating";

export type RegistrationListOptions = {
  status?: RegistrationStatus | "all";
  verifiedOnly?: boolean;
  verifiedFirst: boolean;
  sort?: RegistrationSort;
  /** Podepsat náhledové fotky (seznam ano, navigace v detailu ne) */
  withCovers?: boolean;
};

function oneReview(review: RegistrationReview | RegistrationReview[] | null | undefined): RegistrationReview | null {
  return (Array.isArray(review) ? review[0] : review) ?? null;
}

/**
 * Přihlášky na event pro pořadatele. RLS vrátí jen přihlášky na jeho eventy.
 * Stav = koncept rozhodnutí, pokud existuje. Řazení: podle hvězd, nebo podle
 * času (při „upřednostnit Verified“ nejdřív Verified).
 */
export async function listEventRegistrations(
  eventId: string,
  options: RegistrationListOptions,
): Promise<{ rows: OrganizerRegistrationRow[]; counts: RegistrationCounts; drafts: number }> {
  const empty: RegistrationCounts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    waitlist: 0,
    cancelled: 0,
  };
  if (!UUID.test(eventId)) return { rows: [], counts: empty, drafts: 0 };
  const supabase = await createClient();
  if (!supabase) return { rows: [], counts: empty, drafts: 0 };

  const { data } = await supabase
    .from("event_registrations")
    .select(
      "*, vehicle:vehicles(id, make, model, year, category, visibility, vehicle_photos(id, vehicle_id, position, format, created_at)), applicant:profiles!event_registrations_user_id_fkey(id, username, display_name, verified_at), review:event_registration_reviews(rating, draft_status, draft_reason, draft_message)",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  const all = (data ?? []).map((r) => {
    const review = oneReview(r.review);
    const draftStatus = r.status === "cancelled" ? null : (review?.draft_status ?? null);
    return {
      ...r,
      rating: review?.rating ?? null,
      draftStatus,
      effectiveStatus: draftStatus ?? r.status,
    };
  });
  const counts = { ...empty };
  let drafts = 0;
  for (const r of all) {
    counts[r.effectiveStatus] += 1;
    if (r.draftStatus) drafts += 1;
  }

  let filtered = all;
  if (options.status && options.status !== "all") {
    filtered = filtered.filter((r) => r.effectiveStatus === options.status);
  }
  if (options.verifiedOnly) filtered = filtered.filter((r) => r.applicant?.verified_at);
  const byTime = (a: (typeof all)[number], b: (typeof all)[number]) =>
    (options.verifiedFirst
      ? Number(Boolean(b.applicant?.verified_at)) - Number(Boolean(a.applicant?.verified_at))
      : 0) || a.created_at.localeCompare(b.created_at);
  filtered = [...filtered].sort(
    options.sort === "rating" ? (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byTime(a, b) : byTime,
  );

  const covers = options.withCovers === false
    ? []
    : filtered
        .map((r) => firstPhoto(r.vehicle?.vehicle_photos))
        .filter((p): p is PhotoRow => Boolean(p));
  const urls = await signFiles(
    supabase,
    VEHICLE_PHOTOS_BUCKET,
    covers.map((p) => vehiclePhotoPath(p.vehicle_id, p.id, "sm", p.format)),
  );

  const rows = filtered.map((r) => {
    const cover = firstPhoto(r.vehicle?.vehicle_photos);
    const vehicle = r.vehicle
      ? {
          id: r.vehicle.id,
          make: r.vehicle.make,
          model: r.vehicle.model,
          year: r.vehicle.year,
          category: r.vehicle.category,
          visibility: r.vehicle.visibility,
        }
      : null;
    const { review: _review, ...rest } = r;
    void _review;
    return {
      ...rest,
      vehicle,
      coverUrl: cover
        ? (urls.get(vehiclePhotoPath(cover.vehicle_id, cover.id, "sm", cover.format)) ?? null)
        : null,
    };
  });
  return { rows, counts, drafts };
}

export type RegistrationDetail = Registration & {
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number | null;
    category: Enums<"vehicle_category">;
    type: Enums<"vehicle_type">;
    engine: string | null;
    power_hp: number | null;
    description: string | null;
    story: string | null;
    visibility: "public" | "private";
    mods: Array<{ id: string; category: Enums<"mod_category">; description: string }>;
    photos: Array<{ id: string; md: string | null; lg: string | null }>;
  } | null;
  applicant: {
    id: string;
    username: string | null;
    display_name: string | null;
    verified_at: string | null;
    country: string | null;
    city: string | null;
    avatarUrl: string | null;
  } | null;
  note: string;
  otherRegistrations: number;
  review: RegistrationReview | null;
};

/** Detail přihlášky pro pořadatele (všechny fotky, úpravy, kontakt, poznámka). */
export async function getRegistrationDetail(registrationId: string): Promise<RegistrationDetail | null> {
  if (!UUID.test(registrationId)) return null;
  const supabase = await createClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("event_registrations")
    .select(
      "*, vehicle:vehicles(id, make, model, year, category, type, engine, power_hp, description, story, visibility, vehicle_photos(id, vehicle_id, position, format, created_at), vehicle_mods(id, category, description, position, created_at)), applicant:profiles!event_registrations_user_id_fkey(id, username, display_name, verified_at, country, city, avatar_path), note:event_registration_notes(note), review:event_registration_reviews(rating, draft_status, draft_reason, draft_message)",
    )
    .eq("id", registrationId)
    .maybeSingle();
  if (!data) return null;

  const photos = [...(data.vehicle?.vehicle_photos ?? [])].sort(
    (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
  );
  const photoPaths = photos.flatMap((p) => [
    vehiclePhotoPath(p.vehicle_id, p.id, "md", p.format),
    vehiclePhotoPath(p.vehicle_id, p.id, "lg", p.format),
  ]);
  const [photoUrls, avatarUrls, { count }] = await Promise.all([
    signFiles(supabase, VEHICLE_PHOTOS_BUCKET, photoPaths),
    signFiles(
      supabase,
      AVATARS_BUCKET,
      data.applicant?.avatar_path ? [data.applicant.avatar_path] : [],
    ),
    supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", data.event_id)
      .eq("user_id", data.user_id)
      .neq("id", data.id),
  ]);

  const v = data.vehicle;
  const noteRow = Array.isArray(data.note) ? data.note[0] : data.note;
  return {
    ...data,
    vehicle: v
      ? {
          id: v.id,
          make: v.make,
          model: v.model,
          year: v.year,
          category: v.category,
          type: v.type,
          engine: v.engine,
          power_hp: v.power_hp,
          description: v.description,
          story: v.story,
          visibility: v.visibility,
          mods: [...v.vehicle_mods]
            .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
            .map((m) => ({ id: m.id, category: m.category, description: m.description })),
          photos: photos.map((p) => ({
            id: p.id,
            md: photoUrls.get(vehiclePhotoPath(p.vehicle_id, p.id, "md", p.format)) ?? null,
            lg: photoUrls.get(vehiclePhotoPath(p.vehicle_id, p.id, "lg", p.format)) ?? null,
          })),
        }
      : null,
    applicant: data.applicant
      ? {
          id: data.applicant.id,
          username: data.applicant.username,
          display_name: data.applicant.display_name,
          verified_at: data.applicant.verified_at,
          country: data.applicant.country,
          city: data.applicant.city,
          avatarUrl: data.applicant.avatar_path
            ? (avatarUrls.get(data.applicant.avatar_path) ?? null)
            : null,
        }
      : null,
    note: noteRow?.note ?? "",
    otherRegistrations: count ?? 0,
    review: data.status === "cancelled" ? null : oneReview(data.review),
  };
}
