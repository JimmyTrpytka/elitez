import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { listPublicMembers } from "@/lib/data/members";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { DarkSection, DisplayHeading, Eyebrow } from "@/components/brand";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Members");
  return { title: t("title") };
}

export default async function MembersPage({ searchParams }: PageProps<"/[locale]/members">) {
  const [t, tAuth] = await Promise.all([getTranslations("Members"), getTranslations("Auth")]);
  return (
    <DarkSection className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <Eyebrow dark className="reveal mb-4">
          {t("eyebrow")}
        </Eyebrow>
        <DisplayHeading as="h1" size="lg" className="reveal reveal-delay-1 text-white">
          {t("title")}
        </DisplayHeading>
        <p className="reveal reveal-delay-2 mt-4 mb-10 max-w-2xl text-lg text-white/75">
          {t("subtitle")}
        </p>
        <Suspense fallback={<p className="text-night-subtle">{tAuth("loading")}</p>}>
          <MembersList searchParams={searchParams} />
        </Suspense>
      </div>
    </DarkSection>
  );
}

async function MembersList({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/members">["searchParams"];
}) {
  const [{ q, page }, t, locale] = await Promise.all([
    searchParams,
    getTranslations("Members"),
    getLocale(),
  ]);
  const search = typeof q === "string" ? q.slice(0, 60) : "";
  const pageNumber = Math.max(0, Math.min(100, Number(typeof page === "string" ? page : 0) || 0));
  const { members, hasMore } = await listPublicMembers(search, pageNumber);

  return (
    <div className="flex flex-col gap-6">
      <form className="flex max-w-xl gap-2" role="search">
        <label htmlFor="member-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <input
          id="member-search"
          name="q"
          defaultValue={search}
          placeholder={t("searchPlaceholder")}
          className="h-12 min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-5 text-base text-white placeholder:text-white/40 focus:border-accent focus:outline-none"
        />
        <button type="submit" className={buttonClasses("primary", "md", "h-12")}>
          {t("search")}
        </button>
      </form>

      {members.length === 0 ? (
        <p className="rounded-card bg-night-soft p-8 text-night-subtle">
          {search ? t("noResults") : t("empty")}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => {
            const name = m.displayName ?? m.username;
            const place = [m.city, m.country ? countryName(m.country, locale) : null]
              .filter(Boolean)
              .join(", ");
            return (
              <li key={m.id}>
                <Link
                  href={`/u/${m.username}`}
                  className="group flex items-center gap-4 rounded-card bg-night-soft p-4 ring-1 ring-white/10 transition-all hover:-translate-y-0.5 hover:ring-accent/40"
                >
                  <Avatar url={m.avatarUrl} name={name} size={56} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-display text-2xl leading-tight font-extrabold text-white uppercase">{name}</p>
                      {m.verified ? <Badge>Verified</Badge> : null}
                    </div>
                    <p className="truncate text-sm text-night-subtle">
                      @{m.username}
                      {place ? ` · ${place}` : ""}
                    </p>
                    <p className="mt-0.5 text-sm text-accent">
                      {m.vehicleCount ? t("vehicles", { count: m.vehicleCount }) : t("fan")}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pageNumber > 0 || hasMore ? (
        <nav className="flex gap-2" aria-label={t("pagination")}>
          {pageNumber > 0 ? (
            <Link
              href={{ pathname: "/members", query: { ...(search ? { q: search } : {}), page: pageNumber - 1 } }}
              className={buttonClasses("outlineDark")}
            >
              {t("previous")}
            </Link>
          ) : null}
          {hasMore ? (
            <Link
              href={{ pathname: "/members", query: { ...(search ? { q: search } : {}), page: pageNumber + 1 } }}
              className={buttonClasses("light")}
            >
              {t("next")}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
