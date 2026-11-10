import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function HomePage() {
  const t = await getTranslations("Home");

  const features = [
    { title: t("featureGarageTitle"), text: t("featureGarageText") },
    { title: t("featureEventsTitle"), text: t("featureEventsText") },
    { title: t("featureBadgesTitle"), text: t("featureBadgesText") },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="flex flex-col items-start gap-6 py-20 sm:py-32">
        <p className="text-sm font-semibold tracking-[0.18em] text-subtle uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="max-w-3xl text-4xl leading-[1.05] font-bold tracking-tight text-ink sm:text-6xl">
          {t("title")}
        </h1>
        <p className="max-w-xl text-lg text-ink-soft">{t("subtitle")}</p>
        <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href="/register" className={buttonClasses("primary", "lg")}>
            {t("ctaRegister")}
          </Link>
          <Link href="/login" className={buttonClasses("ghost", "lg")}>
            {t("ctaLogin")}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 pb-24 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-card bg-muted p-6">
            <div className="mb-4">
              <Badge>{t("comingSoon")}</Badge>
            </div>
            <h2 className="text-xl font-semibold text-ink">{f.title}</h2>
            <p className="mt-2 text-ink-soft">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
