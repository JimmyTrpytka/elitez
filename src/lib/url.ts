/** „instagram.com/neco“ → „https://instagram.com/neco“; prázdné → null; nesmysl → undefined. */
export function normalizeUrl(value: string): string | null | undefined {
  const v = value.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".") || /\s/.test(v) || withScheme.length > 200) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export const SOCIAL_KINDS = ["website", "instagram", "tiktok", "youtube", "facebook"] as const;
export type SocialKind = (typeof SOCIAL_KINDS)[number];

const SOCIAL_BASE: Record<Exclude<SocialKind, "website">, string> = {
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/@",
  youtube: "https://www.youtube.com/@",
  facebook: "https://www.facebook.com/",
};

/**
 * Odkaz na sociální síť: „@jmeno“ nebo „jmeno“ doplní na celý odkaz dané sítě,
 * celý odkaz jen zkontroluje. Prázdné → null, nesmysl → undefined.
 */
export function normalizeSocial(kind: SocialKind, value: string): string | null | undefined {
  const v = value.trim();
  if (!v) return null;
  if (kind !== "website" && /^@?[A-Za-z0-9._-]{1,60}$/.test(v)) {
    return SOCIAL_BASE[kind] + v.replace(/^@/, "");
  }
  return normalizeUrl(v);
}
