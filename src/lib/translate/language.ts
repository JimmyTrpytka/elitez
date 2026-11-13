/**
 * Rychlý odhad jazyka textu (bez volání služby) – jen abychom zbytečně
 * nepřekládali český text do češtiny a anglický do angličtiny.
 */
export type GuessedLanguage = "cs" | "en" | "unknown";

const CZECH_CHARS = /[ěščřžůťďňĚŠČŘŽŮŤĎŇ]/;
const CZECH_WORDS = new Set(["je", "a", "na", "se", "v", "pro", "ze", "do", "jsme", "bude", "nebo", "auto", "sraz", "jako", "které", "ale", "už", "jen", "tak", "co"]);
const ENGLISH_WORDS = new Set(["the", "and", "is", "for", "with", "to", "of", "on", "we", "will", "be", "our", "car", "meet", "this", "are", "you", "it", "at", "from"]);

export function guessLanguage(text: string): GuessedLanguage {
  const t = text.trim();
  if (!t) return "unknown";
  if (CZECH_CHARS.test(t)) return "cs";
  let cs = 0;
  let en = 0;
  for (const w of t.toLowerCase().split(/[^a-záéíóúýěščřžůťďň]+/)) {
    if (CZECH_WORDS.has(w)) cs += 1;
    if (ENGLISH_WORDS.has(w)) en += 1;
  }
  if (en >= 2 && en > cs * 2) return "en";
  if (cs >= 2 && cs > en * 2) return "cs";
  return "unknown";
}

/** Má smysl text překládat do daného jazyka? */
export function needsTranslation(text: string, target: "cs" | "en"): boolean {
  if (!text.trim()) return false;
  return guessLanguage(text) !== target;
}
