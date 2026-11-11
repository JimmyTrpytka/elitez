import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  return (
    <footer className="border-t border-line print:hidden">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-subtle sm:px-6">
        {t("tagline")}
      </div>
    </footer>
  );
}
