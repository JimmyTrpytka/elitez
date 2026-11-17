/** Kontrola otázek z editoru (questions_json) před uložením. Bez závislostí → testy. */

export const QUESTION_KINDS = ["text", "number", "boolean", "choice"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export type ParsedQuestion = {
  id: string | null;
  kind: QuestionKind;
  label: string;
  options: string[] | null;
  required: boolean;
};

const UUID = /^[0-9a-f-]{36}$/i;

export function parseQuestionsJson(
  raw: string,
): { ok: true; items: ParsedQuestion[] } | { ok: false } {
  if (!raw.trim()) return { ok: true, items: [] };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  if (!Array.isArray(data) || data.length > 20) return { ok: false };
  const items: ParsedQuestion[] = [];
  for (const q of data) {
    if (!q || typeof q !== "object") return { ok: false };
    const r = q as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const kind = QUESTION_KINDS.find((k) => k === r.kind);
    // Prázdný řádek (bez textu otázky) se tiše vynechá
    if (!label) continue;
    if (!kind || label.length > 200) return { ok: false };
    let options: string[] | null = null;
    if (kind === "choice") {
      const list = (typeof r.options === "string" ? r.options : "")
        .split(/\n|,/)
        .map((o) => o.trim())
        .filter(Boolean);
      options = [...new Set(list)];
      if (options.length < 2 || options.length > 20 || options.some((o) => o.length > 100)) {
        return { ok: false };
      }
    }
    items.push({
      id: typeof r.id === "string" && UUID.test(r.id) ? r.id : null,
      kind,
      label,
      options,
      required: r.required === true,
    });
  }
  return { ok: true, items };
}
