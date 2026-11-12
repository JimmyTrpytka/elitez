import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  LEADERBOARD_PERIODS,
  getLeaderboards,
  type LeaderboardMember,
  type LeaderboardPeriod,
} from "@/lib/data/social";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { DarkSection, DisplayHeading, Eyebrow } from "@/components/brand";
import { TurboIcon } from "@/components/social/turbo-icon";
import { cn } from "@/lib/cn";
import { getCrewLeaderboard, type CrewLeaderboardRow } from "@/lib/data/crews";
import { OrganizerLogo } from "@/components/organizers/organizer-logo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Leaderboard");
  return { title: t("title") };
}

export default async function LeaderboardPage({ searchParams }: PageProps<"/[locale]/leaderboard">) {
  const [t, tAuth] = await Promise.all([getTranslations("Leaderboard"), getTranslations("Auth")]);
  return (
    <DarkSection className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <Eyebrow dark className="reveal mb-4">
          {t("eyebrow")}
        </Eyebrow>
        <DisplayHeading as="h1" size="lg" className="reveal reveal-delay-1 text-white">
          {t("title")}
        </DisplayHeading>
        <p className="reveal reveal-delay-2 mt-4 mb-10 max-w-2xl text-lg text-white/75">{t("subtitle")}</p>
        <Suspense fallback={<p className="text-night-subtle">{tAuth("loading")}</p>}>
          <Boards searchParams={searchParams} />
        </Suspense>
      </div>
    </DarkSection>
  );
}

/** Barvy prvních tří míst: zlato, stříbro, bronz. */
const PODIUM = ["#ffd60a", "#d9dee5", "#d08a4f"];

function Rank({ n }: { n: number }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-xl font-extrabold",
        n > 3 && "bg-white/5 text-night-subtle",
      )}
      style={n <= 3 ? { backgroundColor: PODIUM[n - 1], color: "#070707" } : undefined}
    >
      {n}
    </span>
  );
}

function TurboCount({ n }: { n: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 font-display text-2xl font-extrabold text-white tabular-nums">
      <TurboIcon className="h-5 w-5 text-accent" />
      {n}
    </span>
  );
}

async function Boards({ searchParams }: { searchParams: PageProps<"/[locale]/leaderboard">["searchParams"] }) {
  const [{ period: raw }, t] = await Promise.all([searchParams, getTranslations("Leaderboard")]);
  const period: LeaderboardPeriod = LEADERBOARD_PERIODS.includes(raw as LeaderboardPeriod)
    ? (raw as LeaderboardPeriod)
    : "week";
  const [{ vehicles, garages, fans }, crewsActive, crewsSize] = await Promise.all([
    getLeaderboards(period),
    getCrewLeaderboard("active", period),
    getCrewLeaderboard("size", period),
  ]);

  return (
    <div className="flex flex-col gap-14">
      <nav aria-label={t("periodLabel")} className="flex flex-wrap gap-2">
        {LEADERBOARD_PERIODS.map((p) => (
          <Link
            key={p}
            href={{ pathname: "/leaderboard", query: p === "week" ? {} : { period: p } }}
            aria-current={p === period ? "page" : undefined}
            className={cn(
              "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
              p === period ? "bg-accent text-ink" : "bg-white/5 text-white/85 ring-1 ring-white/15 hover:bg-white/10",
            )}
          >
            {t(`periods.${p}`)}
          </Link>
        ))}
      </nav>

      <section>
        <h2 className="mb-5 font-display text-4xl font-extrabold text-white uppercase">{t("vehiclesTitle")}</h2>
        {vehicles.length ? (
          <ol className="grid gap-3 lg:grid-cols-2">
            {vehicles.map((v, i) => (
              <li key={v.vehicleId}>
                <Link
                  href={`/v/${v.vehicleId}`}
                  className="group flex items-center gap-4 rounded-card bg-night-soft p-3 pr-5 ring-1 ring-white/10 transition-all hover:-translate-y-0.5 hover:ring-accent/40"
                >
                  <Rank n={i + 1} />
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-control bg-white/5">
                    {v.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-xl leading-tight font-extrabold text-white uppercase">
                      {v.title}
                    </p>
                    <p className="truncate text-sm text-night-subtle">
                      {v.year ? `${v.year} · ` : ""}@{v.ownerUsername}
                    </p>
                  </div>
                  <TurboCount n={v.turbos} />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <Empty text={t("empty")} />
        )}
      </section>

      <div className="grid gap-14 lg:grid-cols-2 lg:gap-8">
        <MemberBoard title={t("garagesTitle")} members={garages} empty={t("empty")} />
        <MemberBoard
          title={t("fansTitle")}
          hint={t("fansHint")}
          members={fans}
          empty={t("emptyFans")}
        />
      </div>

      <div className="grid gap-14 lg:grid-cols-2 lg:gap-8">
        <CrewBoard title={t("crewsActiveTitle")} hint={t("crewsActiveHint")} rows={crewsActive} empty={t("emptyCrews")} unit="turbo" />
        <CrewBoard title={t("crewsSizeTitle")} hint={t("crewsSizeHint")} rows={crewsSize} empty={t("emptyCrews")} unit="members" />
      </div>
    </div>
  );
}

function CrewBoard({
  title,
  hint,
  rows,
  empty,
  unit,
}: {
  title: string;
  hint: string;
  rows: CrewLeaderboardRow[];
  empty: string;
  unit: "turbo" | "members";
}) {
  return (
    <section>
      <h2 className="font-display text-4xl font-extrabold text-white uppercase">{title}</h2>
      <p className="mt-1 text-sm text-night-subtle">{hint}</p>
      <div className="mt-5">
        {rows.length ? (
          <ol className="flex flex-col gap-2">
            {rows.map((c, i) => (
              <li key={c.slug}>
                <Link
                  href={`/c/${c.slug}`}
                  className="flex items-center gap-4 rounded-card bg-night-soft p-3 pr-5 ring-1 ring-white/10 transition-all hover:-translate-y-0.5 hover:ring-accent/40"
                >
                  <Rank n={i + 1} />
                  <OrganizerLogo url={c.logoUrl} name={c.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{c.name}</p>
                    {c.focus ? <p className="truncate text-sm text-night-subtle">{c.focus}</p> : null}
                  </div>
                  {unit === "turbo" ? (
                    <TurboCount n={c.score} />
                  ) : (
                    <span className="font-display text-2xl font-extrabold text-white tabular-nums">{c.score}</span>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <Empty text={empty} />
        )}
      </div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-card bg-night-soft p-8 text-night-subtle">{text}</p>;
}

function MemberBoard({
  title,
  hint,
  members,
  empty,
}: {
  title: string;
  hint?: string;
  members: LeaderboardMember[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="font-display text-4xl font-extrabold text-white uppercase">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-night-subtle">{hint}</p> : null}
      <div className="mt-5">
        {members.length ? (
          <ol className="flex flex-col gap-2">
            {members.map((m, i) => (
              <li key={m.username}>
                <Link
                  href={`/u/${m.username}`}
                  className="flex items-center gap-4 rounded-card bg-night-soft p-3 pr-5 ring-1 ring-white/10 transition-all hover:-translate-y-0.5 hover:ring-accent/40"
                >
                  <Rank n={i + 1} />
                  <Avatar url={m.avatarUrl} name={m.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-semibold text-white">
                      <span className="truncate">{m.name}</span>
                      {m.verified ? <Badge>Verified</Badge> : null}
                    </p>
                    <p className="truncate text-sm text-night-subtle">@{m.username}</p>
                  </div>
                  <TurboCount n={m.turbos} />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <Empty text={empty} />
        )}
      </div>
    </section>
  );
}
