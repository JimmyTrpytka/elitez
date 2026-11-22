import "server-only";
import { createPublicClient, type TypedSupabaseClient } from "@/lib/supabase/server";
import { AVATARS_BUCKET, avatarThumbPath } from "@/lib/storage";

/** Platnost dočasných odkazů na soubory (90 minut). */
const SIGNED_URL_TTL = 90 * 60;

/**
 * Jak dlouho server znovu používá už vydaný odkaz na VEŘEJNÝ soubor (30 min).
 * Stejný odkaz = prohlížeč fotku nestahuje znovu (rychlejší web, méně dat).
 * Odkaz pak platí ještě nejméně hodinu. Když majitel soubor skryje,
 * noví návštěvníci ho nejpozději do 30 minut přestanou dostávat.
 */
const REUSE_MS = 30 * 60 * 1000;
const MAX_CACHE = 5000;

/** Mezipaměť odkazů na soubory, které smí číst i nepřihlášený návštěvník. */
const publicUrlCache = new Map<string, { url: string; until: number }>();

function cacheGet(key: string): string | null {
  const hit = publicUrlCache.get(key);
  if (!hit) return null;
  if (hit.until < Date.now()) {
    publicUrlCache.delete(key);
    return null;
  }
  return hit.url;
}

function cacheSet(key: string, url: string) {
  if (publicUrlCache.size >= MAX_CACHE) {
    // nejstarší záznamy pryč (Map drží pořadí vložení)
    for (const k of Array.from(publicUrlCache.keys()).slice(0, MAX_CACHE / 5)) publicUrlCache.delete(k);
  }
  publicUrlCache.set(key, { url, until: Date.now() + REUSE_MS });
}

async function signWith(
  client: TypedSupabaseClient,
  bucket: string,
  paths: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;
  const { data } = await client.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_TTL);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) result.set(item.path, item.signedUrl);
  }
  return result;
}

/**
 * Vytvoří dočasné odkazy na soukromé soubory. Supabase odkaz vydá jen tehdy,
 * když RLS dovolí soubor číst (soukromé vozidlo cizí uživatel nedostane).
 *
 * Veřejné soubory se podepisují jako NEPŘIHLÁŠENÝ návštěvník a odkaz se krátce
 * znovu používá (viz REUSE_MS) – nikdy se tak mezi lidmi nesdílí odkaz na
 * soubor, který by nesměl vidět každý. Ostatní (soukromé) soubory podepíše
 * klient přihlášeného uživatele, bez mezipaměti.
 */
export async function signFiles(
  supabase: TypedSupabaseClient,
  bucket: string,
  paths: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = Array.from(new Set(paths));
  if (unique.length === 0) return result;

  const misses: string[] = [];
  for (const path of unique) {
    const url = cacheGet(`${bucket}/${path}`);
    if (url) result.set(path, url);
    else misses.push(path);
  }
  if (misses.length === 0) return result;

  const anon = await createPublicClient();
  const publicSigned = anon ? await signWith(anon, bucket, misses) : new Map<string, string>();
  const rest: string[] = [];
  for (const path of misses) {
    const url = publicSigned.get(path);
    if (url) {
      cacheSet(`${bucket}/${path}`, url);
      result.set(path, url);
    } else rest.push(path);
  }

  for (const [path, url] of await signWith(supabase, bucket, rest)) result.set(path, url);
  return result;
}

/**
 * Odkazy na MALÉ profilovky (seznamy, žebříčky, „Turbo dali“). Klíčem je původní
 * cesta. Kde malá verze chybí (starší nahrání), použije se původní velká.
 */
export async function signAvatarThumbs(
  supabase: TypedSupabaseClient,
  paths: string[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths));
  const result = new Map<string, string>();
  if (unique.length === 0) return result;
  const thumbs = await signFiles(supabase, AVATARS_BUCKET, unique.map(avatarThumbPath));
  const missing: string[] = [];
  for (const path of unique) {
    const url = thumbs.get(avatarThumbPath(path));
    if (url) result.set(path, url);
    else missing.push(path);
  }
  for (const [path, url] of await signFiles(supabase, AVATARS_BUCKET, missing)) result.set(path, url);
  return result;
}
