import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { signOut } from "@/lib/auth/actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("accountTitle"), robots: { index: false } };
}

export default async function AccountPage() {
  const t = await getTranslations("Auth");
  return (
    <AuthShell title={t("accountTitle")}>
      <Suspense fallback={<p className="text-subtle">{t("loading")}</p>}>
        <AccountContent />
      </Suspense>
    </AuthShell>
  );
}

async function AccountContent() {
  const [t, locale, user] = await Promise.all([
    getTranslations("Auth"),
    getLocale(),
    getCurrentUser(),
  ]);

  // Kontrola na serveru: nepřihlášený uživatel sem nesmí.
  if (!user) {
    return redirect({ href: "/login", locale });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-subtle">{t("accountSignedInAs")}</p>
        <p className="mt-1 text-lg font-semibold break-all text-ink">
          {user.email}
        </p>
      </div>
      <p className="rounded-control bg-muted px-4 py-3 text-sm text-ink-soft">
        {t("accountProfileSoon")}
      </p>
      <form action={signOut}>
        <input type="hidden" name="locale" value={locale} />
        <Button type="submit" variant="secondary" size="lg" className="w-full">
          {t("logout")}
        </Button>
      </form>
    </div>
  );
}
