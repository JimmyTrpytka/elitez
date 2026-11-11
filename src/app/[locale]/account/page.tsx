import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getMyProfile } from "@/lib/data/profiles";
import { getCurrentUser } from "@/lib/auth/user";
import { getMyOrganizer } from "@/lib/data/events";
import { signOut } from "@/lib/auth/actions";
import { PageShell } from "@/components/page-shell";
import { Avatar } from "@/components/avatar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("accountTitle"), robots: { index: false } };
}

export default async function AccountPage() {
  const t = await getTranslations("Auth");
  return (
    <PageShell title={t("accountTitle")}>
      <Suspense fallback={<p className="text-subtle">{t("loading")}</p>}>
        <AccountContent />
      </Suspense>
    </PageShell>
  );
}

async function AccountContent() {
  const [t, tAccount, locale, user, profile, organizer] = await Promise.all([
    getTranslations("Auth"),
    getTranslations("Account"),
    getLocale(),
    getCurrentUser(),
    getMyProfile(),
    getMyOrganizer(),
  ]);

  // Kontrola na serveru: nepřihlášený uživatel sem nesmí.
  if (!user || !profile) {
    return redirect({ href: "/login", locale });
  }

  const name = profile.display_name ?? profile.username ?? user.email ?? "";

  return (
    <div className="flex flex-col gap-6">
      {!profile.username ? (
        <Alert tone="info">
          <span className="font-semibold">{tAccount("finishProfileTitle")}</span>{" "}
          {tAccount("finishProfileText")}
        </Alert>
      ) : null}

      <Card className="flex items-center gap-4">
        <Avatar url={profile.avatarUrl} name={name} size={72} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-xl font-semibold text-ink">{name}</p>
            {profile.verified_at ? <Badge>Verified</Badge> : null}
          </div>
          {profile.username ? (
            <p className="text-subtle">@{profile.username}</p>
          ) : null}
          <p className="mt-1 text-sm break-all text-subtle">{user.email}</p>
        </div>
      </Card>

      {organizer ? (
        <Link
          href="/organizer"
          className="flex items-center justify-between rounded-card bg-ink px-6 py-5 text-white transition-colors hover:bg-ink-soft"
        >
          <span>
            <span className="block text-lg font-semibold">{tAccount("organizer")}</span>
            <span className="text-sm text-white/70">{organizer.name}</span>
          </span>
          <span aria-hidden className="text-2xl text-accent">
            →
          </span>
        </Link>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/garage" className={buttonClasses("primary", "lg")}>
          {tAccount("myGarage")}
        </Link>
        <Link href="/account/registrations" className={buttonClasses("secondary", "lg")}>
          {tAccount("myRegistrations")}
        </Link>
        <Link href="/account/profile" className={buttonClasses("secondary", "lg")}>
          {profile.username ? tAccount("editProfile") : tAccount("finishProfile")}
        </Link>
        {profile.username ? (
          <Link
            href={`/u/${profile.username}`}
            className={buttonClasses("ghost", "lg")}
          >
            {tAccount("viewPublicProfile")}
          </Link>
        ) : null}
      </div>

      {profile.role === "admin" ? (
        <Link href="/admin/feedback" className={buttonClasses("ghost", "lg", "self-start")}>
          {tAccount("feedbackAdmin")}
        </Link>
      ) : null}

      <form action={signOut} className="border-t border-line pt-6">
        <input type="hidden" name="locale" value={locale} />
        <Button type="submit" variant="ghost">
          {t("logout")}
        </Button>
      </form>
    </div>
  );
}
