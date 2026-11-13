import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PromoConsentGate } from "@/components/consent/promo-consent-gate";
import { BetaBanner, BetaBannerFallback } from "@/components/beta-banner";
import { SITE } from "@/lib/site-config";
import { Suspense } from "react";
import "../globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

/** Písmo nadpisů – úzké tučné, s českou diakritikou */
const display = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  variable: "--font-display-family",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    metadataBase: new URL(
      (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.elitezclub.eu").replace(/\/+$/, ""),
    ),
    title: { default: "ELITEZ", template: "%s · ELITEZ" },
    description: t("description"),
    // Výchozí náhled při sdílení odkazu (stránky aut, profilů a eventů mají vlastní)
    openGraph: {
      siteName: "ELITEZ",
      type: "website",
      images: [{ url: "/brand/hero.jpg", width: 2200, height: 1222, alt: "ELITEZ" }],
    },
    twitter: { card: "summary_large_image" },
    applicationName: "ELITEZ",
    appleWebApp: { capable: true, title: "ELITEZ", statusBarStyle: "black-translucent" },
  };
}

export const viewport: Viewport = {
  themeColor: "#070707",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} className={`${inter.variable} ${display.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          {SITE.beta ? (
            <Suspense fallback={<BetaBannerFallback />}>
              <BetaBanner />
            </Suspense>
          ) : null}
          <SiteHeader />
          <main className="flex flex-1 flex-col">{children}</main>
          <SiteFooter />
          <Suspense fallback={null}>
            <PromoConsentGate />
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
