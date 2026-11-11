import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Notification = Tables<"notifications">;

/** Počet nepřečtených upozornění přihlášeného uživatele. */
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  if (!supabase) return 0;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 0;
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id)
    .is("read_at", null);
  return count ?? 0;
}

/** Posledních 50 upozornění přihlášeného uživatele. */
export async function listMyNotifications(): Promise<Notification[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
