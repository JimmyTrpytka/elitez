import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getMyProfile } from "@/lib/data/profiles";
import { getCurrentUser } from "@/lib/auth/user";
import { getMyOrganizer } from "@/lib/data/events";
import { getMyCounts } from "@/lib/data/account";
import { getProfileSocialStats } from "@/lib/data/social";
import { signOut } from "@/lib/auth/actions";
import { PageShell } from "@/components/page-shell";
import { Avatar } from "@/components/avatar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  BellIcon,
  CalendarIcon,
  CarIcon,
  MegaphoneIcon,
  SettingsIcon,
  ShieldIcon,
  SparkleIcon,
  TrophyIcon,
  UserIcon,
} from "@/components/icons";
import { TurboIcon } from "@/components/social/turbo-icon";
import { ProfileProgress } from "@/components/account/profile-progress";
import { InstallHint } from "@/components/install-hint";
import { listProfileCrews } from "@/lib/data/crews";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("accountTitle"), robots: { index: false } };
}

export default async function AccountPage() {
  const t = await getTranslations("Auth");
  return (
    <PageShell width="lg" title={t("accountTitle")}>
      <Suspense fallback={<p className="text-subtle">{t("loading")}</p>}>
        <AccountContent />
      </Suspense>
    </PageShell>
  );
}

/** Dlaždice přehledu: ikona, název, krátký stav, celá plocha je odkaz. */
function Tile({
  href,
  icon,
  title,
  meta,
  highlight,
  dark,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  meta?: string;
  /** Zvýrazněný údaj (např. nepřečtená upozornění) */
  highlight?: boolean;
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-4 rounded-card p-5 transition-all hover:-translate-y-0.5",
        dark
          ? "bg-night text-white ring-1 ring-white/10 hover:ring-accent/50"
          : "bg-muted text-ink hover:bg-white hover:shadow-[0_12px_40px_-16px_rgb(0_0_0/0.25)] hover:ring-1 hover:ring-line",
      )}
    >
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
          dark ? "bg-white/10 text-accent" : "bg-white text-ink",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg leading-tight font-semibold">{title}</span>
        {meta ? (
          <span
            className={cn(
              "mt-0.5 block truncate text-sm",
              highlight
                ? "font-semibold text-ink"
                : dark
                  ? "text-white/60"
                  : "text-subtle",
            )}
          >
            {highlight ? <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent" /> : null}
            {meta}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "text-xl transition-transform group-hover:translate-x-1",
          dark ? "text-accent" : "text-subtle",
        )}
      >
        →
      </span>
    </Link>
  );
}

async function AccountContent() {
  const [t, tA, tP, locale, user, profile, organizer, counts] = await Promise.all([
    getTranslations("Auth"),
    getTranslations("Account"),
    getTranslations("PublicProfile"),
    getLocale(),
    getCurrentUser(),
    getMyProfile(),
    getMyOrganizer(),
    getMyCounts(),
  ]);

  // Kontrola na serveru: nepřihlášený uživatel sem nesmí.
  if (!user || !profile) {
    return redirect({ href: "/login", locale });
  }

  const [stats, myCrews, pendingCrews] = await Promise.all([
    getProfileSocialStats(profile.id),
    listProfileCrews(profile.id),
    profile.role === "admin"
      ? createClient().then(async (s) => (s ? ((await s.rpc("admin_list_crews", { p_status: "pending" })).data?.length ?? 0) : 0))
      : Promise.resolve(0),
  ]);
  const homeCrew = myCrews.find((c) => c.isHome) ?? myCrews[0];
  const name = profile.display_name ?? profile.username ?? user.email ?? "";
  const isFan = counts.vehicles === 0;
  const publicHref = profile.username ? `/u/${profile.username}` : null;
  const icon = "h-6 w-6";

  const numbers: Array<{ label: string; value: ReactNode; href?: string }> = [
    {
      label: tA("statTurbos"),
      value: (
        <span className="inline-flex items-center gap-2">
          <TurboIcon className="h-6 w-6 text-accent" />
          {stats.garageTurbos}
        </span>
      ),
    },
    { label: tA("statFollowers"), value: stats.followers },
    {
      label: tA("statBadges"),
      value: counts.badges,
      href: publicHref ? `${publicHref}#sin-slavy` : undefined,
    },
    { label: tA("statStreak"), value: stats.streak ? `🔥 ${stats.streak}` : "–" },
  ];

  return (
    <div className="flex flex-col gap-10">
      {!profile.username ? (
        <Alert tone="info">
          <span className="font-semibold">{tA("finishProfileTitle")}</span> {tA("finishProfileText")}
        </Alert>
      ) : null}

      {/* Karta profilu – tmavá „výkladní“ část */}
      <section className="glow-accent overflow-hidden rounded-card bg-night text-white">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <Avatar
            url={profile.avatarUrl}
            name={name}
            size={96}
            className="ring-2 ring-accent ring-offset-4 ring-offset-night"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-display text-4xl leading-none font-extrabold uppercase">{name}</p>
              {profile.verified_at ? <Badge>Verified</Badge> : null}
              <span className="rounded-full border border-white/25 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                {isFan ? tP("fan") : tP("owner")}
              </span>
            </div>
            <p className="mt-2 truncate text-sm text-night-subtle">
              {profile.username ? `@${profile.username} · ` : ""}
              {user.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
            {publicHref ? (
              <Link href={publicHref} className={buttonClasses("primary")}>
                {tA("viewPublicProfile")}
              </Link>
            ) : null}
            <Link href="/account/profile" className={buttonClasses("outlineDark")}>
              {profile.username ? tA("editProfile") : tA("finishProfile")}
            </Link>
          </div>
        </div>
        {profile.username ? (
          <dl className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">
            {numbers.map((n, i) => (
              <div
                key={n.label}
                className={cn(
                  "relative px-6 py-5 sm:px-8",
                  n.href && "transition-colors hover:bg-white/5",
                  i % 2 === 1 && "border-l border-white/10",
                  i >= 2 && "max-sm:border-t max-sm:border-white/10",
                  i >= 1 && "sm:border-l sm:border-white/10",
                )}
              >
                <dt className="text-[11px] font-semibold tracking-[0.18em] text-night-subtle uppercase">
                  {n.href ? (
                    // Celá buňka je klikací (odkaz roztažený přes ni)
                    <Link href={n.href} className="after:absolute after:inset-0 hover:text-white">
                      {n.label} <span aria-hidden className="text-accent">→</span>
                    </Link>
                  ) : (
                    n.label
                  )}
                </dt>
                <dd className="mt-1 font-display text-3xl leading-none font-extrabold">{n.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      {/* Připomínka denní série (jako Duolingo) */}
      {stats.streak > 0 && !counts.turboToday ? (
        <section className="flex flex-col gap-4 rounded-card bg-accent p-6 text-ink sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-3xl leading-none font-extrabold uppercase">
              <span aria-hidden>🔥 </span>
              {tA("streakTitle", { count: stats.streak })}
            </p>
            <p className="mt-2">{tA("streakText")}</p>
          </div>
          <Link href="/leaderboard" className={buttonClasses("secondary", "md", "shrink-0 border-ink")}>
            {tA("streakCta")}
          </Link>
        </section>
      ) : null}

      {profile.username ? (
        <ProfileProgress
          steps={[
            { key: "avatar", done: Boolean(profile.avatar_path), href: "/account/profile" },
            { key: "car", done: counts.vehicles > 0 || counts.dreams > 0, href: "/garage" },
            ...(counts.vehicles > 0
              ? [{ key: "photos" as const, done: counts.photos >= 3, href: "/garage" }]
              : []),
            { key: "turbo", done: stats.givenTotal > 0, href: "/leaderboard" },
            { key: "follow", done: stats.following > 0, href: "/members" },
            { key: "bio", done: Boolean(profile.bio), href: "/account/profile" },
          ]}
        />
      ) : null}

      <InstallHint />

      {/* Moje věci */}
      <section>
        <h2 className="mb-4 text-xs font-semibold tracking-[0.2em] text-subtle uppercase">{tA("sectionMine")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Tile
            href="/garage"
            icon={<CarIcon className={icon} />}
            title={tA("myGarage")}
            meta={tA("vehiclesCount", { count: counts.vehicles })}
          />
          <Tile
            href="/garage/dreams"
            icon={<SparkleIcon className={icon} />}
            title={tA("dreams")}
            meta={tA("dreamsCount", { count: counts.dreams })}
          />
          <Tile
            href={homeCrew ? `/c/${homeCrew.slug}` : "/crews"}
            icon={<ShieldIcon className={icon} />}
            title={tA("myCrews")}
            meta={homeCrew ? tA("crewsMeta", { name: homeCrew.name, count: myCrews.length }) : tA("crewsNone")}
          />
          <Tile
            href="/account/registrations"
            icon={<CalendarIcon className={icon} />}
            title={tA("myRegistrations")}
            meta={tA("registrationsCount", { count: counts.activeRegistrations })}
          />
          <Tile
            href="/account/notifications"
            icon={<BellIcon className={icon} />}
            title={tA("notifications")}
            meta={counts.unread ? tA("unreadCount", { count: counts.unread }) : tA("allRead")}
            highlight={counts.unread > 0}
          />
          {publicHref ? (
            <Tile
              href={`${publicHref}#sin-slavy`}
              icon={<TrophyIcon className={icon} />}
              title={tA("hallOfFame")}
              meta={tA("badgesCount", { count: counts.badges })}
            />
          ) : null}
          <Tile
            href="/account/profile"
            icon={<SettingsIcon className={icon} />}
            title={tA("settings")}
            meta={tA("settingsMeta")}
          />
        </div>
      </section>

      {/* Role: pořadatel a admin */}
      {organizer || profile.role === "admin" ? (
        <section>
          <h2 className="mb-4 text-xs font-semibold tracking-[0.2em] text-subtle uppercase">{tA("sectionRoles")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {organizer ? (
              <Tile
                href="/organizer"
                icon={<MegaphoneIcon className={icon} />}
                title={tA("organizer")}
                meta={organizer.name}
                dark
              />
            ) : null}
            {profile.role === "admin" ? (
              <>
                <Tile
                  href="/admin/users"
                  icon={<ShieldIcon className={icon} />}
                  title={tA("adminUsers")}
                  meta={tA("adminTitle")}
                  dark
                />
                <Tile
                  href="/admin/crews"
                  icon={<ShieldIcon className={icon} />}
                  title={tA("adminCrews")}
                  meta={pendingCrews ? tA("adminCrewsPending", { count: pendingCrews }) : tA("adminTitle")}
                  highlight={pendingCrews > 0}
                  dark
                />
                <Tile
                  href="/admin/feedback"
                  icon={<UserIcon className={icon} />}
                  title={tA("feedbackAdmin")}
                  meta={tA("adminTitle")}
                  dark
                />
              </>
            ) : null}
          </div>
        </section>
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
