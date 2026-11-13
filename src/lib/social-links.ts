import { SOCIAL_KINDS, normalizeSocial, type SocialKind } from "@/lib/url";

export type SocialColumn = `${SocialKind}_url`;
export type SocialValues = Record<SocialColumn, string | null>;

/** Přečte a doplní odkazy ze formuláře (pole `instagram_url` …). */
export function parseSocialFields(
  formData: FormData,
  kinds: readonly SocialKind[] = SOCIAL_KINDS,
): { ok: true; values: Partial<SocialValues> } | { ok: false; field: SocialColumn } {
  const values: Partial<SocialValues> = {};
  for (const kind of kinds) {
    const column = `${kind}_url` as SocialColumn;
    const raw = formData.get(column);
    const normalized = normalizeSocial(kind, typeof raw === "string" ? raw : "");
    if (normalized === undefined) return { ok: false, field: column };
    values[column] = normalized;
  }
  return { ok: true, values };
}
