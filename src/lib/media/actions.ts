"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CREATOR_SKILLS } from "@/lib/portfolio/skills";

const UUID = /^[0-9a-f-]{36}$/i;

/** Chyby z databáze (text výjimky) → klíče překladů `MediaErrors`. */
const KNOWN_ERRORS = [
  "not_signed_in",
  "not_creator",
  "username_required",
  "event_unavailable",
  "media_disabled",
  "invite_only",
  "crew_only",
  "registration_closed",
  "consent_required",
  "contact_invalid",
  "already_registered",
  "not_allowed",
  "not_cancellable",
  "event_started",
  "cancelled",
  "message_too_long",
  "media_full",
] as const;

export type MediaErrorKey = (typeof KNOWN_ERRORS)[number] | "generic";
export type MediaResult = { ok: true } | { ok: false; error: MediaErrorKey };

function toErrorKey(message: string | undefined): MediaErrorKey {
  return (KNOWN_ERRORS as readonly string[]).includes(message ?? "") ? (message as MediaErrorKey) : "generic";
}

function refresh() {
  revalidatePath("/", "layout");
}

/** Žádost o akreditaci médií (kontroly dělá databázová funkce request_media). */
export async function requestMedia(input: {
  eventId: string;
  phone: string;
  email: string;
  message: string;
  skills: string[];
  consent: boolean;
}): Promise<MediaResult> {
  if (!UUID.test(input.eventId)) return { ok: false, error: "event_unavailable" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("request_media", {
    p_event_id: input.eventId,
    p_phone: input.phone,
    p_email: input.email,
    p_message: input.message,
    p_skills: CREATOR_SKILLS.filter((s) => input.skills.includes(s)),
    p_consent: input.consent,
  });
  if (error) return { ok: false, error: toErrorKey(error.message) };
  refresh();
  return { ok: true };
}

export async function cancelMediaRequest(requestId: string): Promise<MediaResult> {
  if (!UUID.test(requestId)) return { ok: false, error: "not_allowed" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("cancel_media_request", { p_request_id: requestId });
  if (error) return { ok: false, error: toErrorKey(error.message) };
  refresh();
  return { ok: true };
}

/** Rozhodnutí pořadatele (oprávnění a limit míst hlídá databáze). */
export async function decideMediaRequest(input: {
  requestId: string;
  decision: "approved" | "rejected" | "pending";
  message?: string;
}): Promise<MediaResult> {
  if (!UUID.test(input.requestId)) return { ok: false, error: "not_allowed" };
  if (!["approved", "rejected", "pending"].includes(input.decision)) return { ok: false, error: "not_allowed" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("decide_media_request", {
    p_request_id: input.requestId,
    p_decision: input.decision,
    p_message: input.message?.slice(0, 1000),
  });
  if (error) return { ok: false, error: toErrorKey(error.message) };
  refresh();
  return { ok: true };
}
