import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  return (
    <footer className="border-t border-line print:hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>{t("tagline")}</span>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className="hover:text-ink">
            {t("privacy")}
          </Link>
          <Link href="/feedback" className="hover:text-ink">
            {t("feedback")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
