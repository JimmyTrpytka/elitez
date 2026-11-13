import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCrewBySlug } from "@/lib/data/crews";
import { PageShell } from "@/components/page-shell";
import { CrewEditForm } from "@/components/crews/crew-edit-form";
import { CrewImageUpload } from "@/components/crews/crew-image-upload";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Crews");
  return { title: t("editTitle"), robots: { index: false } };
}

export default async function EditCrewPage({ params }: PageProps<"/[locale]/c/[slug]/edit">) {
  const [t, tAuth] = await Promise.all([getTranslations("Crews"), getTranslations("Auth")]);
  return (
    <PageShell title={t("editTitle")}>
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <Content params={params} />
      </Suspense>
    </PageShell>
  );
}

async function Content({ params }: { params: PageProps<"/[locale]/c/[slug]/edit">["params"] }) {
  const [{ slug }, t] = await Promise.all([params, getTranslations("Crews")]);
  const crew = await getCrewBySlug(decodeURIComponent(slug));
  if (!crew || (crew.stats.myRole !== "founder" && crew.stats.myRole !== "admin")) notFound();
  return (
    <div className="flex flex-col gap-12">
      <p>
        <Link href={`/c/${crew.slug}`} className={textLinkClass}>
          ← {crew.name}
        </Link>
      </p>
      <section>
        <h2 className="mb-4 font-display text-3xl font-extrabold text-ink uppercase">{t("logoTitle")}</h2>
        <CrewImageUpload crewId={crew.id} kind="logo" url={crew.logoUrl} />
      </section>
      <section>
        <h2 className="mb-4 font-display text-3xl font-extrabold text-ink uppercase">{t("coverTitle")}</h2>
        <CrewImageUpload crewId={crew.id} kind="cover" url={crew.coverUrl} />
      </section>
      <section>
        <h2 className="mb-1 font-display text-3xl font-extrabold text-ink uppercase">{t("detailsTitle")}</h2>
        <p className="mb-4 text-sm text-subtle">{t("nameLocked")}</p>
        <CrewEditForm
          values={{
            id: crew.id,
            focus: crew.focus ?? "",
            description: crew.description ?? "",
            join_policy: crew.join_policy,
            social: {
              website_url: crew.website_url,
              instagram_url: crew.instagram_url,
              tiktok_url: crew.tiktok_url,
              youtube_url: crew.youtube_url,
              facebook_url: crew.facebook_url,
            },
          }}
        />
      </section>
    </div>
  );
}
