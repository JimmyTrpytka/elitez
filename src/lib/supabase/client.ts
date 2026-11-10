"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Supabase klient pro prohlížeč – používá se jen na nahrávání souborů
 * (fotky, avatar), aby velké soubory nešly přes náš server.
 * Přihlášení sdílí se serverem přes cookies; práva hlídá RLS.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return createBrowserClient<Database>(url, key);
}
