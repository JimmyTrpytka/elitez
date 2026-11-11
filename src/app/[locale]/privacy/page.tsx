import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SITE } from "@/lib/site-config";
import { PageShell } from "@/components/page-shell";
import { Alert } from "@/components/ui/alert";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Privacy");
  return { title: t("title") };
}

const SECTIONS = ["data", "purpose", "visibility", "storage", "photos", "beta", "rights", "cookies", "age"] as const;

/** Ochrana osobních údajů – verze pro zkušební provoz (plné texty v Milníku 8). */
export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");
  const op = SITE.operator;

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")}>
      <div className="flex flex-col gap-8">
        <Alert tone="info">{t("betaNotice")}</Alert>

        <section>
          <h2 className="mb-2 text-xl font-semibold">{t("operatorTitle")}</h2>
          {op.name ? (
            <p className="leading-relaxed text-ink-soft">
              {op.name}
              {op.companyId ? `, ${t("companyId")} ${op.companyId}` : ""}
              {op.address ? `, ${op.address}` : ""}
              {op.email ? (
                <>
                  <br />
                  {t("contact")}:{" "}
                  <a href={`mailto:${op.email}`} className={textLinkClass}>
                    {op.email}
                  </a>
                </>
              ) : null}
            </p>
          ) : (
            <p className="leading-relaxed text-ink-soft">{t("operatorPending")}</p>
          )}
          <p className="mt-2 text-ink-soft">
            {t("contactForm")}{" "}
            <Link href="/feedback" className={textLinkClass}>
              {t("contactFormLink")}
            </Link>
            .
          </p>
        </section>

        {SECTIONS.map((key) => (
          <section key={key}>
            <h2 className="mb-2 text-xl font-semibold">{t(`sections.${key}.title`)}</h2>
            <p className="leading-relaxed whitespace-pre-line text-ink-soft">
              {t(`sections.${key}.body`)}
            </p>
          </section>
        ))}

        <p className="text-sm text-subtle">{t("updated")}</p>
      </div>
    </PageShell>
  );
}
