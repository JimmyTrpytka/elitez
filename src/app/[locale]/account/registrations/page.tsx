import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatEventDates } from "@/lib/dates";
import { listMyRegistrations } from "@/lib/data/registrations";
import { PageShell } from "@/components/page-shell";
import { CancelRegistrationButton } from "@/components/registrations/cancel-button";
import { EditRegistration } from "@/components/registrations/edit-registration";
import { InfoReply } from "@/components/registrations/info-reply";
import { RegistrationStatusBadge } from "@/components/registrations/status-badge";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { textLinkClass } from "@/components/auth/auth-shell";
import { MyMediaRequests } from "@/components/media/my-media-requests";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MyRegistrations");
  return { title: t("title"), robots: { index: false } };
}

export default async function MyRegistrationsPage({
  searchParams,
}: PageProps<"/[locale]/account/registrations">) {
  const [t, tAuth] = await Promise.all([
    getTranslations("MyRegistrations"),
    getTranslations("Auth"),
  ]);
  return (
    <PageShell
      title={t("title")}
      subtitle={
        <Link href="/account" className={textLinkClass}>
          {t("backToAccount")}
        </Link>
      }
    >
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <MyRegistrationsList searchParams={searchParams} />
        <MyMediaRequests />
      </Suspense>
    </PageShell>
  );
}

async function MyRegistrationsList({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/account/registrations">["searchParams"];
}) {
  const [t, tReasons, locale, { sent }, registrations] = await Promise.all([
    getTranslations("MyRegistrations"),
    getTranslations("RejectionReason"),
    getLocale(),
    searchParams,
    listMyRegistrations(),
  ]);

  const justSent = typeof sent === "string" ? registrations.find((r) => r.id === sent) : undefined;

  return (
    <div className="flex flex-col gap-6">
      {justSent ? (
        <Alert tone="success">
          {justSent.status === "waitlist" ? t("sentWaitlist") : t("sentPending")}
        </Alert>
      ) : null}

      {registrations.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-card bg-muted p-8">
          <p className="text-ink-soft">{t("empty")}</p>
          <Link href="/events" className={buttonClasses("primary")}>
            {t("browseEvents")}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {registrations.map((r) => {
            return (
              <li key={r.id} id={`reg-${r.id}`} className="flex scroll-mt-24 flex-col gap-3 rounded-card border border-line p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {r.event ? (
                      <Link href={`/e/${r.event.slug}`} className="text-lg font-semibold text-ink hover:underline">
                        {r.event.title}
                      </Link>
                    ) : null}
                    <p className="text-sm text-subtle">
                      {r.event
                        ? formatEventDates(r.event.starts_at, r.event.ends_at, locale, r.event.timezone)
                        : ""}
                      {r.vehicle ? ` · ${r.vehicle.make} ${r.vehicle.model}` : ""}
                    </p>
                  </div>
                  <RegistrationStatusBadge status={r.status} />
                </div>
                <p className="text-sm text-ink-soft">{t(`statusText.${r.status}`)}</p>
                {r.status === "rejected" ? (
                  <div className="rounded-control bg-muted px-4 py-3 text-sm text-ink-soft">
                    <p className="font-semibold text-ink">
                      {t("reason")}: {tReasons(r.rejection_reason ?? "other")}
                    </p>
                    {r.decision_message ? (
                      <p className="mt-1 whitespace-pre-line">{r.decision_message}</p>
                    ) : null}
                  </div>
                ) : null}
                {r.info_request && r.info_requested_at && (r.status === "pending" || r.status === "waitlist") ? (
                  <InfoReply
                    registrationId={r.id}
                    request={r.info_request}
                    reply={r.info_reply}
                    canReply={r.canEdit}
                  />
                ) : null}
                {r.status === "approved" && r.event ? (
                  <Link
                    href={`/e/${r.event.slug}#ucastnici`}
                    className="self-start text-sm font-semibold text-ink underline underline-offset-4"
                  >
                    {t("participantInfoLink")}
                  </Link>
                ) : null}
                {r.canEdit ? (
                  <EditRegistration
                    registrationId={r.id}
                    phone={r.contact_phone}
                    email={r.contact_email}
                    message={r.message}
                  />
                ) : null}
                {r.canCancel ? <CancelRegistrationButton registrationId={r.id} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
