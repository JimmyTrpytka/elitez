import { getLocale, getTranslations } from "next-intl/server";
import type { BadgeDef, EarnedBadge, ProfileSocialStats } from "@/lib/data/social";
import { BadgeMedal, RARITY_COLOR } from "./badge-medal";

/** Kategorie, u kterých umíme ukázat postup k další hranici. */
const PROGRESS_CATEGORIES = ["turbo_received", "turbo_given", "streak"] as const;

/**
 * Síň slávy: zeď získaných odznaků. Majitel navíc vidí, kolik mu chybí
 * do dalších odznaků (motivace dávat a sbírat turba).
 */
export async function HallOfFame({
  earned,
  catalog,
  stats,
  isOwner,
}: {
  earned: EarnedBadge[];
  catalog: BadgeDef[];
  stats: ProfileSocialStats;
  isOwner: boolean;
}) {
  const [t, locale] = await Promise.all([getTranslations("HallOfFame"), getLocale()]);
  const en = locale === "en";
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" });
  const earnedCodes = new Set(earned.map((e) => e.badge.code));

  const progressValue: Record<(typeof PROGRESS_CATEGORIES)[number], number> = {
    turbo_received: stats.receivedTotal,
    turbo_given: stats.givenTotal,
    streak: stats.streak,
  };
  // Pro každou kategorii nejbližší nezískaný (neunikátní) odznak
  const next = isOwner
    ? PROGRESS_CATEGORIES.map((cat) =>
        catalog
          .filter((b) => b.category === cat && b.threshold && !b.is_unique && !earnedCodes.has(b.code))
          .sort((a, b) => (a.threshold ?? 0) - (b.threshold ?? 0))[0],
      )
        .filter((b): b is BadgeDef => Boolean(b))
        .map((b) => ({
          badge: b,
          value: Math.min(progressValue[b.category as (typeof PROGRESS_CATEGORIES)[number]], b.threshold ?? 0),
        }))
    : [];

  return (
    <section id="sin-slavy" className="scroll-mt-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-4xl font-extrabold text-white uppercase">{t("title")}</h2>
        <p className="text-sm text-night-subtle">{t("count", { count: earned.length })}</p>
      </div>

      {earned.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {earned.map((e) => {
            const b = e.badge;
            return (
              <li
                key={e.id}
                className="flex flex-col items-center rounded-card bg-night-soft p-5 text-center ring-1 ring-white/10"
                style={b.rarity === "legendary" ? { boxShadow: `inset 0 0 0 1px ${RARITY_COLOR.legendary}55` } : undefined}
              >
                <BadgeMedal icon={b.icon} rarity={b.rarity} size={76} />
                <p className="mt-4 font-display text-xl leading-tight font-extrabold text-white uppercase">
                  {en ? b.name_en : b.name_cs}
                  {e.contextKey ? ` ${e.contextKey}` : ""}
                </p>
                <p
                  className="mt-1 text-[11px] font-semibold tracking-[0.18em] uppercase"
                  style={{ color: RARITY_COLOR[b.rarity] }}
                >
                  {t(`rarity.${b.rarity}`)}
                  {b.is_unique ? ` · ${t("unique")}` : ""}
                </p>
                <p className="mt-2 text-sm text-night-subtle">{en ? b.description_en : b.description_cs}</p>
                <p className="mt-auto pt-3 text-xs text-white/40">{dateFmt.format(new Date(e.awardedAt))}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-card bg-night-soft p-8 text-night-subtle">
          {isOwner ? t("emptyOwner") : t("empty")}
        </p>
      )}

      {next.length ? (
        <div className="mt-10">
          <h3 className="mb-4 text-xs font-semibold tracking-[0.2em] text-night-subtle uppercase">
            {t("nextTitle")}
          </h3>
          <ul className="grid gap-3 sm:grid-cols-3">
            {next.map(({ badge: b, value }) => {
              const pct = Math.round((value / (b.threshold ?? 1)) * 100);
              return (
                <li key={b.code} className="flex items-center gap-4 rounded-card bg-night-soft p-4 ring-1 ring-white/10">
                  <BadgeMedal icon={b.icon} rarity={b.rarity} size={52} locked />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{en ? b.name_en : b.name_cs}</p>
                    <p className="text-xs text-night-subtle">{t(`hint.${b.category as (typeof PROGRESS_CATEGORIES)[number]}`)}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-white/60 tabular-nums">
                      {value} / {b.threshold}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
