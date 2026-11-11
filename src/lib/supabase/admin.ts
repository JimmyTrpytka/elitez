import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Supabase klient s TAJNÝM klíčem (obchází RLS). Používá se JEN na serveru
 * pro odesílání fronty e-mailů. Klíč je v SUPABASE_SECRET_KEY (nikdy NEXT_PUBLIC_).
 * Vrací null, když klíč není nastavený.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
