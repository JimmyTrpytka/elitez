import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/**
 * Supabase klient pro server (stránky, serverové akce, route handlery).
 * Vrací null, pokud Supabase ještě není nastavené v `.env.local`.
 */
export async function createClient(): Promise<SupabaseClient | null> {
  // cookies() čteme vždy jako první: stránka se tak vyhodnotí při každém
  // požadavku a nikdy se neuloží jako statická (ani bez nastavení Supabase).
  const cookieStore = await cookies();
  const env = getSupabaseEnv();
  if (!env) return null;

  return createServerClient(env.url, env.key, {
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
