import { createClient } from "@/lib/supabase/server";

export type CohostStatus = "pending" | "accepted" | "declined";

function status(value: string): CohostStatus {
  return value === "accepted" || value === "declined" ? value : "pending";
}

export type EventCohost = {
  organizerId: string;
  name: string;
  slug: string;
  status: CohostStatus;
  /** true = pozval hlavní pořadatel, false = spolupořadatel požádal */
  invitedByHost: boolean;
};

/**
 * Spolupořadatelé eventu. Návštěvník dostane jen potvrzené (RLS),
 * hlavní pořadatel a zapojení pořadatelé i čekající.
 */
export async function listEventCohosts(eventId: string): Promise<EventCohost[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("event_cohosts")
    .select("organizer_id, status, invited_by_host, created_at, organizer:organizers(name, slug)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  return (data ?? [])
    .filter((r) => r.organizer)
    .map((r) => ({
      organizerId: r.organizer_id,
      name: r.organizer!.name,
      slug: r.organizer!.slug,
      status: status(r.status),
      invitedByHost: r.invited_by_host,
    }));
}

export type MyCohostRow = {
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  organizerId: string;
  organizerName: string;
  status: CohostStatus;
  invitedByHost: boolean;
};

/** Spolupořádání pořadatelů, které spravuji (pozvánky, žádosti, potvrzené). */
export async function listMyCohosting(organizerIds: string[]): Promise<MyCohostRow[]> {
  if (!organizerIds.length) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("event_cohosts")
    .select(
      "event_id, organizer_id, status, invited_by_host, organizer:organizers(name), event:events(title, slug, starts_at, ends_at, timezone)",
    )
    .in("organizer_id", organizerIds)
    .neq("status", "declined")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? [])
    .filter((r) => r.event && r.organizer)
    .map((r) => ({
      eventId: r.event_id,
      eventTitle: r.event!.title,
      eventSlug: r.event!.slug,
      startsAt: r.event!.starts_at,
      endsAt: r.event!.ends_at,
      timezone: r.event!.timezone,
      organizerId: r.organizer_id,
      organizerName: r.organizer!.name,
      status: status(r.status),
      invitedByHost: r.invited_by_host,
    }));
}
