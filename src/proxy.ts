import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/proxy";

const handleI18n = createIntlMiddleware(routing);

/** Stránky, kam smí jen přihlášený uživatel (bez jazykové předpony). */
const protectedPaths = ["/account", "/garage", "/organizer", "/admin"];

export async function proxy(request: NextRequest) {
  // 1) Jazyk: doplní /cs nebo /en do adresy
  const intlResponse = handleI18n(request);

  // 2) Supabase: obnoví přihlášení v cookies
  const { response, isSignedIn } = await updateSession(request, intlResponse);

  // 3) Rychlé přesměrování nepřihlášených (skutečnou kontrolu dělá i stránka)
  const [, locale, ...rest] = request.nextUrl.pathname.split("/");
  const pathWithoutLocale = `/${rest.join("/")}`;
  const isProtected = protectedPaths.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`),
  );
  if (
    isProtected &&
    !isSignedIn &&
    routing.locales.some((l) => l === locale)
  ) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  // Vynechá API, potvrzovací odkazy, ikony PWA, interní soubory Next.js a soubory s příponou
  matcher: ["/((?!api|auth|pwa-icons|_next|_vercel|.*\\..*).*)"],
};
