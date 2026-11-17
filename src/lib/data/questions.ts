import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type EventQuestion = {
  id: string;
  kind: Enums<"event_question_kind">;
  label: string;
  options: string[];
  required: boolean;
};

/** Vlastní otázky eventu v pořadí (RLS: vidí je každý, kdo vidí event). */
export async function getEventQuestions(eventId: string): Promise<EventQuestion[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("event_questions")
    .select("id, kind, label, options, required, position, created_at")
    .eq("event_id", eventId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map((q) => ({
    id: q.id,
    kind: q.kind,
    label: q.label,
    options: q.options ?? [],
    required: q.required,
  }));
}

/** Odpověď jako text (pro detail přihlášky a export). */
export function formatAnswer(
  value: unknown,
  kind: Enums<"event_question_kind">,
  yesNo: { yes: string; no: string },
): string {
  if (value === null || value === undefined || value === "") return "";
  if (kind === "boolean") return value === true ? yesNo.yes : value === false ? yesNo.no : "";
  return String(value);
}

/** Odpovědi z formuláře (pole q_<id>) → objekt pro databázi (ta je zkontroluje). */
export function answersFromForm(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("q_") && typeof value === "string") out[key.slice(2)] = value.slice(0, 600);
  }
  return out;
}
