import { createClient, type TypedSupabaseClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/supabase/database.types";
import {
  AVATARS_BUCKET,
  VEHICLE_PHOTOS_BUCKET,
  signFiles,
  vehiclePhotoPath,
} from "@/lib/storage";

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
  username: string | null;
  isVerified: boolean;
  profilePrivate: boolean;
  vehicles: Array<{
    id: string;
    make: string;
    model: string;
    year: number | null;
    visibility: "public" | "private";
  }>;
};

/** Údaje pro formulář přihlášky (vozidla z garáže, e-mail, Verified). */
export async function getRegistrationFormContext(): Promise<RegistrationFormContext | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [{ data: profile }, { data: vehicles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, verified_at, visibility")
      .eq("id", auth.user.id)
      .single(),
    supabase
      .from("vehicles")
      .select("id, make, model, year, visibility")
      .eq("owner_id", auth.user.id)
      .eq("status", "current")
      .order("created_at", { ascending: false }),
  ]);
  return {
    userId: auth.user.id,
    email: auth.user.email ?? "",
    username: profile?.username ?? null,
    isVerified: Boolean(profile?.verified_at),
    profilePrivate: profile?.visibility === "private",
    vehicles: vehicles ?? [],
  };
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
  } | null;
  /** Lze přihlášku ještě zrušit (aktivní stav a event nezačal)? */
  canCancel: boolean;
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
      "*, vehicle:vehicles(id, make, model), event:events(id, slug, title, starts_at, ends_at, timezone, status)",
    )
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  const now = Date.now();
  return (data ?? []).map((r) => ({
    ...r,
    canCancel:
      ["pending", "approved", "waitlist"].includes(r.status) &&
      Boolean(r.event) &&
      new Date(r.event!.starts_at).getTime() > now,
  }));
}

// ---------------------------------------------------------------------
// Pořadatel
// ---------------------------------------------------------------------

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
};

export type RegistrationCounts = Record<RegistrationStatus, number>;

/**
 * Přihlášky na event pro pořadatele. RLS vrátí jen přihlášky na jeho eventy.
 * Řazení: při „upřednostnit Verified“ nejdřív Verified, pak podle času.
 */
export async function listEventRegistrations(
  eventId: string,
  options: { status?: RegistrationStatus | "all"; verifiedOnly?: boolean; verifiedFirst: boolean },
): Promise<{ rows: OrganizerRegistrationRow[]; counts: RegistrationCounts }> {
  const empty: RegistrationCounts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    waitlist: 0,
    cancelled: 0,
  };
  if (!UUID.test(eventId)) return { rows: [], counts: empty };
  const supabase = await createClient();
  if (!supabase) return { rows: [], counts: empty };

  const { data } = await supabase
    .from("event_registrations")
    .select(
      "*, vehicle:vehicles(id, make, model, year, category, visibility, vehicle_photos(id, vehicle_id, position, format, created_at)), applicant:profiles!event_registrations_user_id_fkey(id, username, display_name, verified_at)",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  const all = data ?? [];
  const counts = { ...empty };
  for (const r of all) counts[r.status] += 1;

  let filtered = all;
  if (options.status && options.status !== "all") {
    filtered = filtered.filter((r) => r.status === options.status);
  }
  if (options.verifiedOnly) filtered = filtered.filter((r) => r.applicant?.verified_at);
  if (options.verifiedFirst) {
    filtered = [...filtered].sort(
      (a, b) =>
        Number(Boolean(b.applicant?.verified_at)) - Number(Boolean(a.applicant?.verified_at)) ||
        a.created_at.localeCompare(b.created_at),
    );
  }

  const covers = filtered
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
    return {
      ...r,
      vehicle,
      coverUrl: cover
        ? (urls.get(vehiclePhotoPath(cover.vehicle_id, cover.id, "sm", cover.format)) ?? null)
        : null,
    };
  });
  return { rows, counts };
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
};

/** Detail přihlášky pro pořadatele (všechny fotky, úpravy, kontakt, poznámka). */
export async function getRegistrationDetail(registrationId: string): Promise<RegistrationDetail | null> {
  if (!UUID.test(registrationId)) return null;
  const supabase = await createClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("event_registrations")
    .select(
      "*, vehicle:vehicles(id, make, model, year, category, type, engine, power_hp, description, story, visibility, vehicle_photos(id, vehicle_id, position, format, created_at), vehicle_mods(id, category, description, position, created_at)), applicant:profiles!event_registrations_user_id_fkey(id, username, display_name, verified_at, country, city, avatar_path), note:event_registration_notes(note)",
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
  };
}
