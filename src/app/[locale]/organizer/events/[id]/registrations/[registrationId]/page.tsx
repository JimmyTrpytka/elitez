import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { formatDateTime } from "@/lib/dates";
import { getMyEvent, getMyOrganizer } from "@/lib/data/events";
import { getRegistrationDetail } from "@/lib/data/registrations";
import { hpToKw } from "@/lib/validation";
import { PageShell } from "@/components/page-shell";
import { Avatar } from "@/components/avatar";
import { RegistrationDecision } from "@/components/organizer/registration-decision";
import { RegistrationNote } from "@/components/organizer/registration-note";
import { RegistrationStatusBadge } from "@/components/registrations/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Applications");
  return { title: t("detailTitle"), robots: { index: false } };
}

type Params = PageProps<"/[locale]/organizer/events/[id]/registrations/[registrationId]">["params"];

export default async function RegistrationDetailPage({
  params,
}: PageProps<"/[locale]/organizer/events/[id]/registrations/[registrationId]">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-4xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}
    >
      <RegistrationDetailContent params={params} />
    </Suspense>
  );
}

async function RegistrationDetailContent({ params }: { params: Params }) {
  const { id, registrationId } = await params;
  const [t, tVehicle, tMods, tReasons, locale, organizer] = await Promise.all([
    getTranslations("Applications"),
    getTranslations("Vehicle"),
    getTranslations("Mods"),
    getTranslations("RejectionReason"),
    getLocale(),
    getMyOrganizer(),
  ]);
  if (!organizer) notFound();
  const [event, reg] = await Promise.all([
    getMyEvent(organizer.id, id),
    getRegistrationDetail(registrationId),
  ]);
  if (!event || !reg || reg.event_id !== event.id) notFound();

  const v = reg.vehicle;
  const a = reg.applicant;
  const name = a?.display_name ?? a?.username ?? "—";
  const specs: Array<[string, string]> = v
    ? [
        [tVehicle("typeLabel"), tVehicle(`types.${v.type}`)],
        [tVehicle("categoryLabel"), tVehicle(`categories.${v.category}`)],
        ...(v.year ? [[tVehicle("yearLabel"), String(v.year)] as [string, string]] : []),
        ...(v.engine ? [[tVehicle("engineLabel"), v.engine] as [string, string]] : []),
        ...(v.power_hp
          ? [[t("power"), `${v.power_hp} k / ${hpToKw(v.power_hp)} kW`] as [string, string]]
          : []),
      ]
    : [];

  return (
    <PageShell
      title={v ? `${v.make} ${v.model}` : t("detailTitle")}
      subtitle={
        <span className="flex flex-wrap items-center gap-3">
          <Link href={`/organizer/events/${event.id}/registrations`} className={textLinkClass}>
            {t("backToList")}
          </Link>
          <RegistrationStatusBadge status={reg.status} />
          {v?.visibility === "private" ? (
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">
              {t("privateVehicle")}
            </span>
          ) : null}
        </span>
      }
    >
      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t("decisionTitle")}</h2>
          {reg.status === "rejected" ? (
            <p className="mb-4 text-sm text-ink-soft">
              {t("rejectedWith", { reason: tReasons(reg.rejection_reason ?? "other") })}
              {reg.decision_message ? ` „${reg.decision_message}“` : ""}
            </p>
          ) : null}
          <RegistrationDecision registrationId={reg.id} status={reg.status} />
        </Card>

        {v?.photos.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {v.photos.map((p) =>
              p.md ? (
                <a key={p.id} href={p.lg ?? p.md} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.md} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-control object-cover" />
                </a>
              ) : null,
            )}
          </div>
        ) : (
          <p className="rounded-card bg-muted p-6 text-ink-soft">{t("noPhotos")}</p>
        )}

        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t("vehicleTitle")}</h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {specs.map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-subtle">{label}</dt>
                <dd className="font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          {v?.description ? (
            <p className="mt-5 whitespace-pre-line text-ink-soft">{v.description}</p>
          ) : null}
          {v?.story ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-ink">{t("story")}</summary>
              <p className="mt-2 whitespace-pre-line text-ink-soft">{v.story}</p>
            </details>
          ) : null}
          {v?.mods.length ? (
            <ul className="mt-5 divide-y divide-line rounded-control border border-line">
              {v.mods.map((m) => (
                <li key={m.id} className="flex gap-4 px-4 py-2.5 text-sm">
                  <span className="w-32 shrink-0 text-subtle">{tMods(`categories.${m.category}`)}</span>
                  <span className="text-ink">{m.description}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t("applicantTitle")}</h2>
          <div className="flex items-center gap-4">
            <Avatar url={a?.avatarUrl ?? null} name={name} size={56} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-ink">{name}</p>
                {a?.verified_at ? <Badge>Verified</Badge> : null}
              </div>
              <p className="text-sm text-subtle">
                @{a?.username ?? "—"}
                {a?.city || a?.country
                  ? ` · ${[a?.city, a?.country ? countryName(a.country, locale) : null].filter(Boolean).join(", ")}`
                  : ""}
              </p>
            </div>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-subtle">{t("phone")}</dt>
              <dd>
                <a href={`tel:${reg.contact_phone}`} className={textLinkClass}>
                  {reg.contact_phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-subtle">{t("email")}</dt>
              <dd className="break-all">
                <a href={`mailto:${reg.contact_email}`} className={textLinkClass}>
                  {reg.contact_email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-subtle">{t("submittedAt")}</dt>
              <dd className="font-semibold text-ink">
                {formatDateTime(reg.created_at, locale, event.timezone)}
              </dd>
            </div>
            {reg.otherRegistrations > 0 ? (
              <div>
                <dt className="text-sm text-subtle">{t("otherRegistrationsLabel")}</dt>
                <dd className="font-semibold text-ink">
                  {t("otherRegistrations", { count: reg.otherRegistrations })}
                </dd>
              </div>
            ) : null}
          </dl>
          {reg.message ? (
            <div className="mt-5 rounded-control bg-muted px-4 py-3">
              <p className="text-sm text-subtle">{t("messageFromApplicant")}</p>
              <p className="mt-1 whitespace-pre-line text-ink">{reg.message}</p>
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-1 text-lg font-semibold">{t("noteTitle")}</h2>
          <p className="mb-4 text-sm text-subtle">{t("noteHint")}</p>
          <RegistrationNote registrationId={reg.id} initial={reg.note} />
        </Card>
      </div>
    </PageShell>
  );
}
