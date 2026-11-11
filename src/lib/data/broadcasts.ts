import { createClient } from "@/lib/supabase/server";
import { Constants, type Enums, type Tables } from "@/lib/supabase/database.types";

export type Broadcast = Tables<"message_broadcasts">;
export type BroadcastSegment = Enums<"broadcast_segment">;

/** Počet příjemců pro každou skupinu (pro výběr ve formuláři). */
export async function getSegmentCounts(eventId: string): Promise<Record<BroadcastSegment, number>> {
  const result = Object.fromEntries(
    Constants.public.Enums.broadcast_segment.map((s) => [s, 0]),
  ) as Record<BroadcastSegment, number>;
  const supabase = await createClient();
  if (!supabase) return result;
  const counts = await Promise.all(
    Constants.public.Enums.broadcast_segment.map((segment) =>
      supabase.rpc("broadcast_recipient_count", { p_event_id: eventId, p_segment: segment }),
    ),
  );
  Constants.public.Enums.broadcast_segment.forEach((segment, i) => {
    result[segment] = counts[i].data ?? 0;
  });
  return result;
}

/** Historie hromadných zpráv eventu (nejnovější první). */
export async function listBroadcasts(eventId: string): Promise<Broadcast[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("message_broadcasts")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

/** Kolik e-mailů k tomuto eventu ještě čeká ve frontě. */
export async function getEmailQueueCount(eventId: string): Promise<number> {
  const supabase = await createClient();
  if (!supabase) return 0;
  const { data } = await supabase.rpc("event_email_queue_count", { p_event_id: eventId });
  return data ?? 0;
}
