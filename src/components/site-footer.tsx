import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  return (
    <footer className="border-t border-white/10 bg-night text-night-subtle print:hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>{t("tagline")}</span>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className="hover:text-white">
            {t("privacy")}
          </Link>
          <Link href="/feedback" className="hover:text-white">
            {t("feedback")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
