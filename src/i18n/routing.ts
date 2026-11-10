import { defineRouting } from "next-intl/routing";

/** Podporované jazyky. Adresy mají tvar /cs/... a /en/... */
export const routing = defineRouting({
  locales: ["cs", "en"],
  defaultLocale: "cs",
});

export type Locale = (typeof routing.locales)[number];
