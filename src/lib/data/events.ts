import { createClient, type TypedSupabaseClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { getCurrentOrganizerId } from "@/lib/organizer/current";
import { EVENT_IMAGES_BUCKET, eventImagePath, signFiles, type PhotoSize } from "@/lib/storage";

export type Organizer = Tables<"organizers">;
export type Season = Tables<"seasons">;
export type EventRow = Tables<"events">;

export type EventView = EventRow & {
  cover: Partial<Record<PhotoSize, string>>;
  organizerName: string | null;
  organizerSlug: string | null;
  seasonName: string | null;
};

async function withCovers(
  supabase: TypedSupabaseClient,
  rows: Array<EventRow & { organizer?: { name: string; slug: string } | null; season?: { name: string } | null }>,
  sizes: PhotoSize[],
): Promise<EventView[]> {
  const paths = rows.flatMap((r) =>
    r.cover_path && r.cover_format
      ? sizes.map((s) => eventImagePath(r.cover_path!, s, r.cover_format!))
      : [],
  );
  const urls = await signFiles(supabase, EVENT_IMAGES_BUCKET, paths);
  return rows.map(({ organizer, season, ...r }) => ({
    ...r,
    organizerName: organizer?.name ?? null,
    organizerSlug: organizer?.slug ?? null,
    seasonName: season?.name ?? null,
    cover: Object.fromEntries(
      r.cover_path && r.cover_format
        ? sizes
            .map((s) => [s, urls.get(eventImagePath(r.cover_path!, s, r.cover_format!))])
            .filter(([, u]) => Boolean(u))
        : [],
    ),
  }));
}

const PUBLIC_SELECT = "*, organizer:organizers!events_organizer_id_fkey(name, slug), season:seasons(name)";

// ---------------------------------------------------------------------
// Veřejnost
// ---------------------------------------------------------------------

/** Zveřejněné eventy pro veřejný seznam (bez konceptů a eventů na pozvánky). */
export async function listPublicEvents(organizerId?: string, includeCrewOnly = false): Promise<{
  upcoming: EventView[];
  past: EventView[];
}> {
  const supabase = await createClient();
  if (!supabase) return { upcoming: [], past: [] };
  let query = supabase
    .from("events")
    .select(PUBLIC_SELECT)
    .in("status", ["published", "closed", "cancelled"])
    // „jen pro členy crew“ vrátí databáze jen členům (RLS)
    .in("access", includeCrewOnly ? ["public", "verified_only", "crew_only"] : ["public", "verified_only"]);
  // Volitelně jen eventy jednoho pořadatele (profil pořadatele)
  if (organizerId) {
    // i eventy, které pořadatel potvrzeně spolupořádá
    const { data: cohosted } = await supabase
      .from("event_cohosts")
      .select("event_id")
      .eq("organizer_id", organizerId)
      .eq("status", "accepted")
      .limit(200);
    const ids = (cohosted ?? []).map((r) => r.event_id).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    query = ids.length
      ? query.or(`organizer_id.eq.${organizerId},id.in.(${ids.join(",")})`)
      : query.eq("organizer_id", organizerId);
  }
  const { data } = await query.order("starts_at", { ascending: true }).limit(200);
  const all = await withCovers(supabase, data ?? [], ["md"]);
  const now = Date.now();
  return {
    upcoming: all.filter((e) => new Date(e.ends_at).getTime() >= now),
    past: all.filter((e) => new Date(e.ends_at).getTime() < now).reverse(),
  };
}

/** Detail eventu podle adresy. RLS vrátí koncept / pozvánkový event jen pořadateli. */
export async function getEventBySlug(slug: string): Promise<EventView | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("events")
    .select(PUBLIC_SELECT)
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (!data) return null;
  const [view] = await withCovers(supabase, [data], ["md", "lg"]);
  return view;
}

// ---------------------------------------------------------------------
// Pořadatel
// ---------------------------------------------------------------------

/**
 * Pořadatel, kterého přihlášený právě spravuje (vlastní nebo za crew;
 * výběr v sekci Pořadatel). Null = žádný schválený.
 */
export async function getMyOrganizer(): Promise<Organizer | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const id = await getCurrentOrganizerId();
  if (!id) return null;
  const { data } = await supabase
    .from("organizers")
    .select("*")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();
  return data;
}

export type SeasonWithCount = Season & { eventCount: number };

export async function listMySeasons(organizerId: string): Promise<SeasonWithCount[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("seasons")
    .select("*, events(count)")
    .eq("organizer_id", organizerId)
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []).map(({ events, ...s }) => ({
    ...s,
    eventCount: events?.[0]?.count ?? 0,
  }));
}

export async function getMySeason(organizerId: string, seasonId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(seasonId)) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", seasonId)
    .eq("organizer_id", organizerId)
    .maybeSingle();
  return data;
}

/** Eventy pořadatele (volitelně jen jedné sezóny, nebo jen bez sezóny). */
export async function listMyEvents(
  organizerId: string,
  seasonId: string | null | undefined,
): Promise<EventRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase
    .from("events")
    .select("*")
    .eq("organizer_id", organizerId)
    .order("starts_at", { ascending: true });
  if (seasonId === null) query = query.is("season_id", null);
  else if (seasonId) query = query.eq("season_id", seasonId);
  const { data } = await query;
  return data ?? [];
}

export async function getMyEvent(
  organizerId: string,
  eventId: string,
): Promise<EventView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("events")
    .select(PUBLIC_SELECT)
    .eq("id", eventId)
    .eq("organizer_id", organizerId)
    .maybeSingle();
  if (!data) return null;
  const [view] = await withCovers(supabase, [data], ["md"]);
  return view;
}
