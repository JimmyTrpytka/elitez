import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listPublicCrews } from "@/lib/data/crews";
import { getMyProfile } from "@/lib/data/profiles";
import { DarkSection, DisplayHeading, Eyebrow } from "@/components/brand";
import { CrewCard } from "@/components/crews/crew-card";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Crews");
  return { title: t("title") };
}

export default async function CrewsPage({ searchParams }: PageProps<"/[locale]/crews">) {
  const [t, tAuth] = await Promise.all([getTranslations("Crews"), getTranslations("Auth")]);
  return (
    <DarkSection className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <Eyebrow dark className="reveal mb-4">
          {t("eyebrow")}
        </Eyebrow>
        <DisplayHeading as="h1" size="lg" className="reveal reveal-delay-1 text-white">
          {t("title")}
        </DisplayHeading>
        <p className="reveal reveal-delay-2 mt-4 mb-8 max-w-2xl text-lg text-white/75">{t("subtitle")}</p>
        <Suspense fallback={<p className="text-night-subtle">{tAuth("loading")}</p>}>
          <CrewsContent searchParams={searchParams} />
        </Suspense>
      </div>
    </DarkSection>
  );
}

async function CrewsContent({ searchParams }: { searchParams: PageProps<"/[locale]/crews">["searchParams"] }) {
  const [{ q, page }, t, me] = await Promise.all([searchParams, getTranslations("Crews"), getMyProfile()]);
  const search = typeof q === "string" ? q.slice(0, 60) : "";
  const pageNumber = Math.max(0, Math.min(100, Number(typeof page === "string" ? page : 0) || 0));
  const { crews, hasMore } = await listPublicCrews(search, pageNumber);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form className="flex max-w-xl flex-1 gap-2" role="search">
          <label htmlFor="crew-search" className="sr-only">
            {t("searchLabel")}
          </label>
          <input
            id="crew-search"
            name="q"
            defaultValue={search}
            placeholder={t("searchPlaceholder")}
            className="h-12 min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-5 text-base text-white placeholder:text-white/40 focus:border-accent focus:outline-none"
          />
          <button type="submit" className={buttonClasses("primary", "md", "h-12")}>
            {t("search")}
          </button>
        </form>
        {me?.verified_at ? (
          <Link href="/crews/new" className={buttonClasses("light", "md", "shrink-0 self-start")}>
            + {t("create")}
          </Link>
        ) : (
          <p className="max-w-xs text-sm text-night-subtle">{t("createVerifiedOnly")}</p>
        )}
      </div>

      {crews.length === 0 ? (
        <p className="rounded-card bg-night-soft p-8 text-night-subtle">{search ? t("noResults") : t("empty")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {crews.map((c) => (
            <li key={c.id}>
              <CrewCard crew={c} />
            </li>
          ))}
        </ul>
      )}

      {pageNumber > 0 || hasMore ? (
        <nav className="flex gap-2">
          {pageNumber > 0 ? (
            <Link
              href={{ pathname: "/crews", query: { ...(search ? { q: search } : {}), page: pageNumber - 1 } }}
              className={buttonClasses("outlineDark")}
            >
              {t("previous")}
            </Link>
          ) : null}
          {hasMore ? (
            <Link
              href={{ pathname: "/crews", query: { ...(search ? { q: search } : {}), page: pageNumber + 1 } }}
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
