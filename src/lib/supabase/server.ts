import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Supabase klient pro server (stránky, serverové akce, route handlery).
 * Vrací null, pokud Supabase ještě není nastavené v `.env.local`.
 */
export async function createClient(): Promise<TypedSupabaseClient | null> {
  // cookies() čteme vždy jako první: stránka se tak vyhodnotí při každém
  // požadavku a nikdy se neuloží jako statická (ani bez nastavení Supabase).
  const cookieStore = await cookies();
  // Supabase při ověřování přihlášení pracuje s aktuálním časem – výslovně
  // označíme, že se tato část počítá až při požadavku (vyžaduje Next.js).
  await connection();
  const env = getSupabaseEnv();
  if (!env) return null;

  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Volání ze Server Componenty nemůže zapisovat cookies.
          // Nevadí – přihlášení obnovuje proxy (src/proxy.ts).
        }
      },
    },
  });
}

/**
 * Klient „jako nepřihlášený návštěvník“ (bez cookies). Vidí jen veřejná data –
 * používá se pro náhledy odkazů, aby se do nich nikdy nedostal soukromý obsah.
 */
export async function createPublicClient(): Promise<TypedSupabaseClient | null> {
  await connection();
  const env = getSupabaseEnv();
  if (!env) return null;
  return createSupabaseClient<Database>(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
