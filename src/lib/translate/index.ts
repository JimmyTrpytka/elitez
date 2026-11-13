import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { needsTranslation } from "./language";

/**
 * Automatické překlady přes DeepL s mezipamětí v databázi (`translations`).
 * Každý text se přeloží jen jednou. Bez klíče DEEPL_API_KEY se nic nepřekládá
 * (vrací null) – web pak ukazuje původní texty jako dosud.
 */
export type TargetLang = "cs" | "en";
export type Translated = { text: string; translated: boolean; sourceLang: string | null };

const MAX_CHARS_PER_TEXT = 6000;

export function translationEnabled(): boolean {
  return Boolean(process.env.DEEPL_API_KEY);
}

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function callDeepL(texts: string[], target: TargetLang): Promise<Array<{ text: string; detected: string }> | null> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return null;
  // Bezplatné klíče končí „:fx“ a mají vlastní adresu
  const host = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  try {
    const res = await fetch(`${host}/v2/translate`, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: texts,
        target_lang: target === "en" ? "EN-GB" : "CS",
        preserve_formatting: true,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error("[ELITEZ] DeepL odpověděl chybou", res.status);
      return null;
    }
    const json = (await res.json()) as { translations?: Array<{ text: string; detected_source_language: string }> };
    return (json.translations ?? []).map((t) => ({ text: t.text, detected: t.detected_source_language.toLowerCase() }));
  } catch (e) {
    console.error("[ELITEZ] DeepL nedostupný", e);
    return null;
  }
}

/**
 * Přeloží texty do cílového jazyka. Texty, které už v cílovém jazyce jsou
 * (nebo jsou prázdné), vrátí beze změny. Null = překlady vypnuté / nedostupné.
 */
export async function translateTexts(texts: string[], target: TargetLang): Promise<Translated[] | null> {
  if (!translationEnabled()) return null;
  const admin = createAdminClient();
  if (!admin) return null;

  const items = texts.map((original) => {
    const text = original.slice(0, MAX_CHARS_PER_TEXT);
    return { original, text, todo: needsTranslation(text, target), hash: hash(text) };
  });
  const todo = items.filter((i) => i.todo);
  const result = new Map<string, Translated>();
  if (todo.length === 0) {
    return items.map((i) => ({ text: i.original, translated: false, sourceLang: null }));
  }

  // 1) Mezipaměť
  const { data: cached } = await admin
    .from("translations")
    .select("source_hash, source_lang, translated")
    .eq("target_lang", target)
    .in("source_hash", [...new Set(todo.map((i) => i.hash))]);
  for (const c of cached ?? []) {
    result.set(c.source_hash, {
      text: c.translated,
      translated: c.source_lang !== target,
      sourceLang: c.source_lang,
    });
  }

  // 2) Chybějící přes DeepL (po dávkách)
  const missing = [...new Map(todo.filter((i) => !result.has(i.hash)).map((i) => [i.hash, i])).values()];
  for (let start = 0; start < missing.length; start += 40) {
    const batch = missing.slice(start, start + 40);
    const out = await callDeepL(batch.map((b) => b.text), target);
    if (!out) break;
    const rows = batch.map((b, i) => {
      const tr = out[i];
      const sourceLang = tr?.detected?.slice(0, 2) ?? null;
      const translated = tr?.text ?? b.text;
      result.set(b.hash, { text: translated, translated: sourceLang !== target, sourceLang });
      return {
        source_hash: b.hash,
        target_lang: target,
        source_lang: sourceLang,
        translated,
        characters: b.text.length,
      };
    });
    await admin.from("translations").upsert(rows, { onConflict: "source_hash,target_lang" });
  }

  return items.map((i) => {
    const hit = i.todo ? result.get(i.hash) : undefined;
    return hit && hit.translated
      ? { text: hit.text, translated: true, sourceLang: hit.sourceLang }
      : { text: i.original, translated: false, sourceLang: hit?.sourceLang ?? null };
  });
}
