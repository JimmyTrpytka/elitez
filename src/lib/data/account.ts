import { createClient } from "@/lib/supabase/server";

export type MyCounts = {
  vehicles: number;
  former: number;
  dreams: number;
  badges: number;
  unread: number;
  activeRegistrations: number;
};

const ZERO: MyCounts = { vehicles: 0, former: 0, dreams: 0, badges: 0, unread: 0, activeRegistrations: 0 };

/** Počty pro záložky garáže a dlaždice „Můj účet“ (jen hlavičky, žádná data). */
export async function getMyCounts(): Promise<MyCounts> {
  const supabase = await createClient();
  if (!supabase) return ZERO;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return ZERO;
  const uid = auth.user.id;
  const head = { count: "exact" as const, head: true };

  const [vehicles, former, dreams, badges, unread, regs] = await Promise.all([
    supabase.from("vehicles").select("id", head).eq("owner_id", uid).eq("status", "current"),
    supabase.from("vehicles").select("id", head).eq("owner_id", uid).eq("status", "former"),
    supabase.from("dream_cars").select("id", head).eq("owner_id", uid),
    supabase.from("user_badges").select("id", head).eq("user_id", uid),
    supabase.from("notifications").select("id", head).eq("user_id", uid).is("read_at", null),
    supabase
      .from("event_registrations")
      .select("id", head)
      .eq("user_id", uid)
      .in("status", ["pending", "approved", "waitlist"]),
  ]);
  return {
    vehicles: vehicles.count ?? 0,
    former: former.count ?? 0,
    dreams: dreams.count ?? 0,
    badges: badges.count ?? 0,
    unread: unread.count ?? 0,
    activeRegistrations: regs.count ?? 0,
  };
}
