"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { CREW_IMAGES_BUCKET, crewImagePath } from "@/lib/storage";

/** Chyby jako klíče do překladů `Crews.errors`. */
export type CrewError =
  | "notAuthenticated"
  | "usernameRequired"
  | "verifiedRequired"
  | "nameInvalid"
  | "nameTaken"
  | "pendingExists"
  | "crewLimit"
  | "notFound"
  | "alreadyMember"
  | "membershipLimit"
  | "founderCannotLeave"
  | "notAllowed"
  | "tooLong"
  | "generic";

const MAP: Record<string, CrewError> = {
  not_authenticated: "notAuthenticated",
  username_required: "usernameRequired",
  verified_required: "verifiedRequired",
  name_invalid: "nameInvalid",
  name_taken: "nameTaken",
  pending_exists: "pendingExists",
  crew_limit: "crewLimit",
  not_found: "notFound",
  already_member: "alreadyMember",
  membership_limit: "membershipLimit",
  founder_cannot_leave: "founderCannotLeave",
  not_allowed: "notAllowed",
  not_member: "notAllowed",
};

function toError(message: string | undefined): CrewError {
  return (message && MAP[message]) || "generic";
}

const UUID = /^[0-9a-f-]{36}$/i;

function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function refresh() {
  revalidatePath("/", "layout");
}

export type CrewResult = { ok: true } | { ok: false; error: CrewError };
export type CrewFormState = { status: "idle" } | { status: "error"; error: CrewError; field?: string };

/** Založení crew (čeká na schválení adminem). */
export async function createCrew(_prev: CrewFormState, formData: FormData): Promise<CrewFormState> {
  const localeValue = text(formData, "locale");
  const locale = hasLocale(routing.locales, localeValue) ? localeValue : routing.defaultLocale;
  const name = text(formData, "name");
  const focus = text(formData, "focus");
  const description = text(formData, "description");
  const joinPolicy = text(formData, "join_policy") === "open" ? "open" : "approval";
  if (name.length < 3 || name.length > 60) return { status: "error", error: "nameInvalid", field: "name" };
  if (focus.length > 80 || description.length > 2000) return { status: "error", error: "tooLong" };

  const supabase = await createClient();
  if (!supabase) return { status: "error", error: "generic" };
  const { data, error } = await supabase.rpc("create_crew", {
    p_name: name,
    p_description: description || undefined,
    p_focus: focus || undefined,
    p_join_policy: joinPolicy,
  });
  if (error || !data) {
    const e = toError(error?.message);
    return { status: "error", error: e, field: e === "nameTaken" || e === "nameInvalid" ? "name" : undefined };
  }
  const { data: crew } = await supabase.from("crews").select("slug").eq("id", data).single();
  refresh();
  redirect(`/${locale}/c/${crew?.slug ?? ""}?created=1`);
}

/** Podobné existující crew (při psaní názvu). */
export async function findSimilarCrews(name: string): Promise<Array<{ slug: string; name: string; status: string }>> {
  if (name.trim().length < 3) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.rpc("similar_crews", { p_name: name.slice(0, 60) });
  return data ?? [];
}

export type JoinResult = { ok: true; status: "active" | "pending" } | { ok: false; error: CrewError };

export async function joinCrew(crewId: string): Promise<JoinResult> {
  if (!UUID.test(crewId)) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { data, error } = await supabase.rpc("join_crew", { p_crew_id: crewId });
  if (error || !data) return { ok: false, error: toError(error?.message) };
  refresh();
  return { ok: true, status: data };
}

export async function leaveCrew(crewId: string): Promise<CrewResult> {
  if (!UUID.test(crewId)) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("leave_crew", { p_crew_id: crewId });
  if (error) return { ok: false, error: toError(error.message) };
  refresh();
  return { ok: true };
}

export async function setHomeCrew(crewId: string): Promise<CrewResult> {
  if (!UUID.test(crewId)) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("set_home_crew", { p_crew_id: crewId });
  if (error) return { ok: false, error: toError(error.message) };
  refresh();
  return { ok: true };
}

export async function decideCrewMember(
  crewId: string,
  userId: string,
  action: "approve" | "reject" | "remove",
): Promise<CrewResult> {
  if (!UUID.test(crewId) || !UUID.test(userId)) return { ok: false, error: "notAllowed" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("decide_crew_member", { p_crew_id: crewId, p_user_id: userId, p_action: action });
  if (error) return { ok: false, error: toError(error.message) };
  refresh();
  return { ok: true };
}

export type CrewEditState = { status: "idle" } | { status: "saved" } | { status: "error"; error: CrewError };

/** Úprava crew správcem (popis, zaměření, vstup). */
export async function updateCrew(_prev: CrewEditState, formData: FormData): Promise<CrewEditState> {
  const id = text(formData, "id");
  const focus = text(formData, "focus");
  const description = text(formData, "description");
  const joinPolicy = text(formData, "join_policy") === "open" ? "open" : "approval";
  if (!UUID.test(id)) return { status: "error", error: "notAllowed" };
  if (focus.length > 80 || description.length > 2000) return { status: "error", error: "tooLong" };
  const supabase = await createClient();
  if (!supabase) return { status: "error", error: "generic" };
  const { data, error } = await supabase
    .from("crews")
    .update({ focus: focus || null, description: description || null, join_policy: joinPolicy })
    .eq("id", id)
    .select("id");
  if (error) return { status: "error", error: "generic" };
  if (!data?.length) return { status: "error", error: "notAllowed" };
  refresh();
  return { status: "saved" };
}

/** Logo nebo úvodní fotka, kterou prohlížeč nahrál; starou smaže. */
export async function setCrewImage(input: {
  crewId: string;
  kind: "logo" | "cover";
  key: string;
  format: string;
}): Promise<CrewResult> {
  if (!UUID.test(input.crewId) || !UUID.test(input.key)) return { ok: false, error: "notAllowed" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { data: crew } = await supabase
    .from("crews")
    .select("id, logo_key, logo_format, cover_key, cover_format")
    .eq("id", input.crewId)
    .maybeSingle();
  if (!crew) return { ok: false, error: "notAllowed" };
  const format = input.format === "jpg" ? "jpg" : "webp";
  const patch =
    input.kind === "logo"
      ? { logo_key: input.key, logo_format: format }
      : { cover_key: input.key, cover_format: format };
  const { data, error } = await supabase.from("crews").update(patch).eq("id", input.crewId).select("id");
  if (error || !data?.length) return { ok: false, error: "notAllowed" };
  const oldKey = input.kind === "logo" ? crew.logo_key : crew.cover_key;
  const oldFormat = input.kind === "logo" ? crew.logo_format : crew.cover_format;
  if (oldKey && oldFormat) {
    await supabase.storage
      .from(CREW_IMAGES_BUCKET)
      .remove((["sm", "md", "lg"] as const).map((s) => crewImagePath(crew.id, oldKey, s, oldFormat)));
  }
  refresh();
  return { ok: true };
}

/** Admin: schválit / zamítnout / pozastavit / obnovit crew. */
export async function adminSetCrewStatus(
  crewId: string,
  status: "approved" | "rejected" | "suspended",
  reason?: string,
): Promise<CrewResult> {
  if (!UUID.test(crewId)) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("admin_set_crew_status", {
    p_crew_id: crewId,
    p_status: status,
    p_reason: reason?.slice(0, 500) || undefined,
  });
  if (error) return { ok: false, error: toError(error.message) };
  refresh();
  return { ok: true };
}
