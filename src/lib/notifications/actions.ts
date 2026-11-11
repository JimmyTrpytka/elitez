"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Označí všechna upozornění přihlášeného uživatele jako přečtená. */
export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", auth.user.id)
    .is("read_at", null);
  if (!error) revalidatePath("/", "layout");
  return { ok: !error };
}
