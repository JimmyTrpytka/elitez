import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { getSupabaseEnv } from "./env";

/**
 * Při každém požadavku obnoví přihlášení (cookies) a vrátí, zda je
 * uživatel přihlášený. Slouží jen k rychlému přesměrování – skutečná
 * kontrola oprávnění probíhá vždy na serveru a v databázi.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<{ response: NextResponse; isSignedIn: boolean }> {
  const env = getSupabaseEnv();
  if (!env) return { response, isSignedIn: false };

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // getClaims ověří podpis přihlašovacího tokenu a v případě potřeby ho obnoví.
  const { data } = await supabase.auth.getClaims();
  return { response, isSignedIn: Boolean(data?.claims?.sub) };
}
