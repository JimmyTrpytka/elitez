import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

/** Povolí jen přesměrování v rámci našeho webu (ochrana proti zneužití odkazu). */
function safeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return `/${routing.defaultLocale}/account`;
}

function localeOf(path: string): string {
  const segment = path.split("/")[1];
  return routing.locales.find((l) => l === segment) ?? routing.defaultLocale;
}

/**
 * Sem vedou odkazy z e-mailů (potvrzení registrace, obnova hesla).
 * Ověří odkaz u Supabase, přihlásí uživatele a pošle ho dál.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  if (supabase) {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, request.url));
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });
      if (!error) return NextResponse.redirect(new URL(next, request.url));
    }
  }

  const failUrl = new URL(`/${localeOf(next)}/login`, request.url);
  failUrl.searchParams.set("error", "link");
  return NextResponse.redirect(failUrl);
}
