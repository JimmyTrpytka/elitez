"use server";

import { createClient } from "@/lib/supabase/server";
import { translateTexts } from "@/lib/translate";

export type TranslateResult =
  | { ok: true; texts: Record<string, string>; sourceLang: string | null }
  | { ok: false; error: "unavailable" | "notFound" };

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Překlad textů auta nebo profilu na kliknutí. Texty se čtou s právy volajícího
 * (RLS) – přeložit jde jen to, co smí vidět. Výsledek se ukládá do mezipaměti.
 */
export async function translateContent(
  kind: "vehicle" | "profile",
  id: string,
  localeValue: string,
): Promise<TranslateResult> {
  if (!UUID.test(id)) return { ok: false, error: "notFound" };
  const target = localeValue === "en" ? "en" : "cs";
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unavailable" };

  const fields: Record<string, string> = {};
  if (kind === "vehicle") {
    const { data } = await supabase
      .from("vehicles")
      .select("description, story, vehicle_mods(id, description)")
      .eq("id", id)
      .maybeSingle();
    if (!data) return { ok: false, error: "notFound" };
    if (data.description) fields.description = data.description;
    if (data.story) fields.story = data.story;
    for (const m of data.vehicle_mods) fields[`mod:${m.id}`] = m.description;
  } else {
    const { data } = await supabase.from("profiles").select("bio").eq("id", id).maybeSingle();
    if (!data) return { ok: false, error: "notFound" };
    if (data.bio) fields.bio = data.bio;
  }

  const keys = Object.keys(fields);
  const out = await translateTexts(keys.map((k) => fields[k]), target);
  if (!out) return { ok: false, error: "unavailable" };
  const texts: Record<string, string> = {};
  keys.forEach((k, i) => {
    texts[k] = out[i]?.text ?? fields[k];
  });
  return { ok: true, texts, sourceLang: out.find((x) => x.translated)?.sourceLang ?? null };
}
