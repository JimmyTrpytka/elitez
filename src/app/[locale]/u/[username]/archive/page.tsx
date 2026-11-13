import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getProfileByUsername } from "@/lib/data/profiles";
import { listPortfolio } from "@/lib/data/portfolio";
import { PortfolioGallery } from "@/components/portfolio/portfolio-gallery";
import { getCurrentUser } from "@/lib/auth/user";
import { getPortfolioTurbos } from "@/lib/data/social";
import { DisplayHeading, Eyebrow } from "@/components/brand";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/u/[username]/archive">): Promise<Metadata> {
  const { username } = await params;
  const t = await getTranslations("PublicProfile");
  return { title: `${t("archiveTitle")} · @${decodeURIComponent(username)}` };
}

export default async function PortfolioArchivePage({ params }: PageProps<"/[locale]/u/[username]/archive">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}>
      <Archive params={params} />
    </Suspense>
  );
}

async function Archive({ params }: { params: PageProps<"/[locale]/u/[username]/archive">["params"] }) {
  const { username } = await params;
  const [t, profile] = await Promise.all([
    getTranslations("PublicProfile"),
    getProfileByUsername(decodeURIComponent(username)),
  ]);
  if (!profile || !profile.is_creator) notFound();
  const [{ items }, user] = await Promise.all([listPortfolio(profile.id, "archive"), getCurrentUser()]);
  const turbos = await getPortfolioTurbos(items.map((i) => i.id));
  const mode = user?.id === profile.id ? "own" : user ? "active" : "guest";
  const name = profile.display_name ?? profile.username ?? "";

  return (
    <div className="flex-1 bg-night text-night-text">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <Link
          href={`/u/${profile.username}#portfolio`}
          className="text-sm font-semibold text-white underline decoration-accent decoration-2 underline-offset-4"
        >
          ← {t("archiveBack", { name })}
        </Link>
        <Eyebrow dark className="mt-8 mb-2">
          @{profile.username}
        </Eyebrow>
        <DisplayHeading as="h1" size="lg" className="mb-3 text-white">
          {t("archiveTitle")}
        </DisplayHeading>
        <p className="mb-10 max-w-2xl text-night-subtle">{t("archiveText")}</p>
        {items.length ? (
          <PortfolioGallery
            items={items}
            alt={name}
            turbo={profile.visibility === "public" ? { mode, viewerId: user?.id ?? null, initial: turbos } : undefined}
          />
        ) : (
          <p className="rounded-card bg-night-soft p-8 text-night-subtle">{t("archiveEmpty")}</p>
        )}
      </div>
    </div>
  );
}
