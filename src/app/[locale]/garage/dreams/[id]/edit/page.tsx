import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMyDream } from "@/lib/data/dreams";
import { PageShell } from "@/components/page-shell";
import { DreamForm } from "@/components/dreams/dream-form";
import { DeleteDreamButton, DreamPhoto } from "@/components/dreams/dream-photo";
import { Alert } from "@/components/ui/alert";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dreams");
  return { title: t("editTitle"), robots: { index: false } };
}

export default async function EditDreamPage(props: PageProps<"/[locale]/garage/dreams/[id]/edit">) {
  const [t, tAuth] = await Promise.all([getTranslations("Dreams"), getTranslations("Auth")]);
  return (
    <PageShell
      title={t("editTitle")}
      subtitle={
        <Link href="/garage/dreams" className={textLinkClass}>
          {t("backToDreams")}
        </Link>
      }
    >
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <EditDreamContent {...props} />
      </Suspense>
    </PageShell>
  );
}

async function EditDreamContent({ params, searchParams }: PageProps<"/[locale]/garage/dreams/[id]/edit">) {
  const [{ id }, { created }, t] = await Promise.all([params, searchParams, getTranslations("Dreams")]);
  const dream = await getMyDream(id);
  if (!dream) notFound();

  return (
    <div className="flex flex-col gap-12">
      {created ? <Alert tone="success">{t("createdNotice")}</Alert> : null}

      <section>
        <h2 className="mb-4 font-display text-3xl font-extrabold text-ink uppercase">{t("photoTitle")}</h2>
        <DreamPhoto
          dreamId={dream.id}
          ownerId={dream.ownerId}
          photoUrl={dream.photoUrl}
          hasOwnPhoto={dream.hasOwnPhoto}
        />
      </section>

      <section>
        <h2 className="mb-4 font-display text-3xl font-extrabold text-ink uppercase">{t("detailsTitle")}</h2>
        {dream.linked ? (
          <p className="mb-4 text-sm text-ink-soft">
            {t("linkedNotice")}{" "}
            <Link href={`/v/${dream.linked.vehicleId}`} className={textLinkClass}>
              {t("linkedOpen")}
            </Link>
          </p>
        ) : null}
        <DreamForm
          values={{
            id: dream.id,
            make: dream.make,
            model: dream.model,
            year_from: dream.yearFrom ? String(dream.yearFrom) : "",
            year_to: dream.yearTo ? String(dream.yearTo) : "",
            note: dream.note ?? "",
            status: dream.status,
            visibility: dream.visibility,
          }}
        />
      </section>

      <section className="border-t border-line pt-8">
        <DeleteDreamButton dreamId={dream.id} />
      </section>
    </div>
  );
}
