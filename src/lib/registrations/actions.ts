"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Constants } from "@/lib/supabase/database.types";
import type { Enums } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

/** Chyby z databáze (text výjimky) → klíče překladů. */
const KNOWN_ERRORS = [
  "not_signed_in",
  "event_unavailable",
  "invite_only",
  "username_required",
  "verified_only",
  "registration_not_set",
  "not_open_yet",
  "registration_closed",
  "vehicle_invalid",
  "private_ack_required",
  "consent_required",
  "contact_invalid",
  "already_registered",
  "not_allowed",
  "not_cancellable",
  "event_started",
  "cancelled",
  "message_too_long",
] as const;

export type RegistrationErrorKey = (typeof KNOWN_ERRORS)[number] | "generic";

function toErrorKey(message: string | undefined): RegistrationErrorKey {
  return (KNOWN_ERRORS as readonly string[]).includes(message ?? "")
    ? (message as RegistrationErrorKey)
    : "generic";
}

function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

function refresh() {
  revalidatePath("/", "layout");
}

export type RegistrationFormState =
  | { status: "idle" }
  | { status: "error"; error: RegistrationErrorKey };

/** Odeslání přihlášky (všechny kontroly dělá databázová funkce register_for_event). */
export async function submitRegistration(
  _prev: RegistrationFormState,
  formData: FormData,
): Promise<RegistrationFormState> {
  const localeValue = text(formData, "locale");
  const locale = hasLocale(routing.locales, localeValue) ? localeValue : routing.defaultLocale;
  const eventId = text(formData, "event_id");
  const vehicleId = text(formData, "vehicle_id");
  if (!UUID.test(eventId)) return { status: "error", error: "event_unavailable" };
  if (!UUID.test(vehicleId)) return { status: "error", error: "vehicle_invalid" };

  const supabase = await createClient();
  if (!supabase) return { status: "error", error: "generic" };

  const { data, error } = await supabase.rpc("register_for_event", {
    p_event_id: eventId,
    p_vehicle_id: vehicleId,
    p_phone: text(formData, "phone"),
    p_email: text(formData, "email"),
    p_message: text(formData, "message"),
    p_consent: formData.get("consent") === "on",
    p_private_ack: formData.get("private_ack") === "on",
  });
  if (error || !data) return { status: "error", error: toErrorKey(error?.message) };

  refresh();
  redirect(`/${locale}/account/registrations?sent=${data.id}`);
}

export type SimpleResult = { ok: true } | { ok: false; error: RegistrationErrorKey };

export async function cancelMyRegistration(registrationId: string): Promise<SimpleResult> {
  if (!UUID.test(registrationId)) return { ok: false, error: "not_allowed" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("cancel_registration", {
    p_registration_id: registrationId,
  });
  if (error) return { ok: false, error: toErrorKey(error.message) };
  refresh();
  return { ok: true };
}

export type DecisionResult =
  | { ok: true; status: Enums<"registration_status"> }
  | { ok: false; error: RegistrationErrorKey };

/** Rozhodnutí pořadatele (oprávnění a kapacitu kontroluje databáze). */
export async function decideRegistration(input: {
  registrationId: string;
  decision: Enums<"registration_status">;
  reason?: Enums<"rejection_reason">;
  message?: string;
}): Promise<DecisionResult> {
  if (!UUID.test(input.registrationId)) return { ok: false, error: "not_allowed" };
  const decisions: readonly string[] = ["approved", "rejected", "waitlist", "pending"];
  if (!decisions.includes(input.decision)) return { ok: false, error: "not_allowed" };
  const reason =
    input.reason && (Constants.public.Enums.rejection_reason as readonly string[]).includes(input.reason)
      ? input.reason
      : undefined;

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { data, error } = await supabase.rpc("decide_registration", {
    p_registration_id: input.registrationId,
    p_decision: input.decision,
    p_reason: reason,
    p_message: input.message?.slice(0, 1000),
  });
  if (error || !data) return { ok: false, error: toErrorKey(error?.message) };
  refresh();
  return { ok: true, status: data.status };
}

/** Interní poznámka pořadatele k přihlášce (uchazeč ji nevidí – hlídá RLS). */
export async function saveRegistrationNote(
  registrationId: string,
  note: string,
): Promise<SimpleResult> {
  if (!UUID.test(registrationId)) return { ok: false, error: "not_allowed" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "not_signed_in" };

  const trimmed = note.trim().slice(0, 2000);
  const { error } = trimmed
    ? await supabase.from("event_registration_notes").upsert({
        registration_id: registrationId,
        note: trimmed,
        updated_at: new Date().toISOString(),
        updated_by: auth.user.id,
      })
    : await supabase.from("event_registration_notes").delete().eq("registration_id", registrationId);
  if (error) return { ok: false, error: "not_allowed" };
  refresh();
  return { ok: true };
}
