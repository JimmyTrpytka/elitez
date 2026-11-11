"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

export type RoleResult = { ok: true } | { ok: false; error: "not_allowed" | "cannot_demote_self" | "generic" };

function toError(message: string | undefined): RoleResult {
  if (message === "cannot_demote_self") return { ok: false, error: "cannot_demote_self" };
  if (message === "not_allowed") return { ok: false, error: "not_allowed" };
  return { ok: false, error: "generic" };
}

/** Udělit / odebrat roli administrátora (oprávnění kontroluje databáze). */
export async function setUserAdmin(userId: string, enabled: boolean): Promise<RoleResult> {
  if (!UUID.test(userId)) return { ok: false, error: "generic" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("admin_set_admin", { p_user_id: userId, p_enabled: enabled });
  if (error) return toError(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Udělit / odebrat roli pořadatele (odebrání profil jen pozastaví). */
export async function setUserOrganizer(userId: string, enabled: boolean): Promise<RoleResult> {
  if (!UUID.test(userId)) return { ok: false, error: "generic" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("admin_set_organizer", {
    p_user_id: userId,
    p_enabled: enabled,
  });
  if (error) return toError(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}
