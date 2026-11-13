/**
 * Rychlý odhad jazyka textu (bez volání služby) – jen abychom zbytečně
 * nepřekládali český text do češtiny a anglický do angličtiny.
 */
export type GuessedLanguage = "cs" | "en" | "unknown";

// Písmena typická pro češtinu (ý je i ve slovenštině – tu čeští čtenáři přečtou)
const CZECH_CHARS = /[ěščřžůťďňýĚŠČŘŽŮŤĎŇÝ]/;
const CZECH_WORDS = new Set(["je", "a", "na", "se", "v", "ve", "s", "z", "k", "o", "u", "za", "od", "po", "pro", "ze", "do", "jsme", "jsem", "bude", "byl", "nebo", "auto", "auta", "sraz", "jako", "které", "který", "ale", "už", "jen", "tak", "co", "kde", "bez", "při", "mám", "máme"]);
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

/** Krátké texty (jména, názvy, hesla s emoji) nepřekládáme – není co. */
function isTooShort(text: string): boolean {
  const words = text.match(/\p{L}{2,}/gu) ?? [];
  return words.length < 5;
}

/** Má smysl text překládat do daného jazyka? */
export function needsTranslation(text: string, target: "cs" | "en"): boolean {
  if (!text.trim()) return false;
  const guess = guessLanguage(text);
  if (guess === target) return false;
  // Nejistý odhad u krátkého textu → tlačítko „Přeložit“ neukazovat
  if (guess === "unknown" && isTooShort(text)) return false;
  return true;
}
