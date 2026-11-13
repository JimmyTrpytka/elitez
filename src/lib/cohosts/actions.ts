"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

const KNOWN_ERRORS = [
  "not_allowed",
  "event_unavailable",
  "own_event",
  "organizer_unavailable",
  "cohost_limit",
  "already_cohost",
  "already_requested",
  "not_pending",
] as const;

export type CohostErrorKey = (typeof KNOWN_ERRORS)[number] | "generic";
export type CohostResult = { ok: true; status?: string } | { ok: false; error: CohostErrorKey };

function toError(message: string | undefined): CohostResult {
  return {
    ok: false,
    error: (KNOWN_ERRORS as readonly string[]).includes(message ?? "") ? (message as CohostErrorKey) : "generic",
  };
}

function refresh() {
  revalidatePath("/", "layout");
}

/** Spolupořadatel žádá o spolupořádání eventu (za pořadatele, kterého spravuje). */
export async function requestCohost(eventId: string, organizerId: string): Promise<CohostResult> {
  if (!UUID.test(eventId) || !UUID.test(organizerId)) return { ok: false, error: "not_allowed" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { data, error } = await supabase.rpc("request_event_cohost", {
    p_event_id: eventId,
    p_organizer_id: organizerId,
  });
  if (error) return toError(error.message);
  refresh();
  return { ok: true, status: data ?? undefined };
}

/** Hlavní pořadatel zve dalšího pořadatele podle adresy (/o/<adresa> nebo celý odkaz). */
export async function inviteCohost(eventId: string, organizer: string): Promise<CohostResult> {
  if (!UUID.test(eventId)) return { ok: false, error: "not_allowed" };
  const slug = organizer
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/^\/(cs|en)\//, "/")
    .replace(/^\/?o\//, "")
    .replace(/[/?#].*$/, "");
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return { ok: false, error: "organizer_unavailable" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { data, error } = await supabase.rpc("invite_event_cohost", {
    p_event_id: eventId,
    p_organizer_slug: slug,
  });
  if (error) return toError(error.message);
  refresh();
  return { ok: true, status: data ?? undefined };
}

export async function decideCohost(eventId: string, organizerId: string, accept: boolean): Promise<CohostResult> {
  if (!UUID.test(eventId) || !UUID.test(organizerId)) return { ok: false, error: "not_allowed" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("decide_event_cohost", {
    p_event_id: eventId,
    p_organizer_id: organizerId,
    p_accept: accept,
  });
  if (error) return toError(error.message);
  refresh();
  return { ok: true };
}

export async function removeCohost(eventId: string, organizerId: string): Promise<CohostResult> {
  if (!UUID.test(eventId) || !UUID.test(organizerId)) return { ok: false, error: "not_allowed" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("remove_event_cohost", {
    p_event_id: eventId,
    p_organizer_id: organizerId,
  });
  if (error) return toError(error.message);
  refresh();
  return { ok: true };
}
