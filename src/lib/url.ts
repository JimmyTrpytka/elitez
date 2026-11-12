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
