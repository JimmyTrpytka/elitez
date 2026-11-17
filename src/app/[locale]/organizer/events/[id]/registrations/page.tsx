import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/dates";
import { getMyEvent, getMyOrganizer } from "@/lib/data/events";
import {
  listEventRegistrations,
  type RegistrationSort,
  type RegistrationStatus,
} from "@/lib/data/registrations";
import { QuickApprove } from "@/components/organizer/quick-approve";
import { ReleaseDecisions } from "@/components/organizer/release-decisions";
import { StarRating } from "@/components/organizer/star-rating";
import { PageShell } from "@/components/page-shell";
import { RegistrationStatusBadge } from "@/components/registrations/status-badge";
import { Badge } from "@/components/ui/badge";
import { textLinkClass } from "@/components/auth/auth-shell";
import { cn } from "@/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Applications");
  return { title: t("title"), robots: { index: false } };
}

const FILTERS: Array<RegistrationStatus | "all"> = [
  "pending",
  "approved",
  "waitlist",
  "rejected",
  "cancelled",
  "all",
];

export default async function RegistrationsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/organizer/events/[id]/registrations">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-5xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}
    >
      <RegistrationsContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function RegistrationsContent({
  params,
  searchParams,
}: {
  params: PageProps<"/[locale]/organizer/events/[id]/registrations">["params"];
  searchParams: PageProps<"/[locale]/organizer/events/[id]/registrations">["searchParams"];
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [t, tStatus, tCat, locale, organizer] = await Promise.all([
    getTranslations("Applications"),
    getTranslations("RegistrationStatus"),
    getTranslations("Vehicle"),
    getLocale(),
    getMyOrganizer(),
  ]);
  if (!organizer) notFound();
  const event = await getMyEvent(organizer.id, id);
  if (!event) notFound();

  const status =
    typeof sp.status === "string" && (FILTERS as string[]).includes(sp.status)
      ? (sp.status as RegistrationStatus | "all")
      : "pending";
  const verifiedOnly = sp.verified === "1";
  const sort: RegistrationSort = sp.sort === "rating" ? "rating" : "time";
  const { rows, counts, drafts } = await listEventRegistrations(event.id, {
    status,
    verifiedOnly,
    verifiedFirst: event.verified_priority,
    sort,
  });

  const query = (s: RegistrationStatus | "all", v: boolean, so: RegistrationSort) => ({
    status: s,
    ...(v ? { verified: "1" } : {}),
    ...(so === "rating" ? { sort: "rating" } : {}),
  });
  const filterHref = (s: RegistrationStatus | "all", v: boolean, so: RegistrationSort = sort) => ({
    pathname: `/organizer/events/${event.id}/registrations`,
    query: query(s, v, so),
  });

  return (
    <PageShell
      width="lg"
      title={t("title")}
      subtitle={
        <Link href={`/organizer/events/${event.id}`} className={textLinkClass}>
          ← {event.title}
        </Link>
      }
    >
      {event.hold_decisions || drafts > 0 ? (
        <ReleaseDecisions eventId={event.id} drafts={drafts} />
      ) : null}
      <div className="mb-6 flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <p className="text-3xl font-bold text-ink">
          {counts.approved}
          {event.capacity ? <span className="text-subtle"> / {event.capacity}</span> : null}
        </p>
        <p className="text-ink-soft">
          {t("summary", { pending: counts.pending, waitlist: counts.waitlist })}
        </p>
      </div>

      <nav className="mb-6 flex flex-wrap gap-2" aria-label={t("filtersLabel")}>
        {FILTERS.map((f) => {
          const count =
            f === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[f];
          return (
            <Link
              key={f}
              href={filterHref(f, verifiedOnly)}
              aria-current={status === f ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                status === f ? "bg-ink text-white" : "bg-muted text-ink hover:bg-line",
              )}
            >
              {f === "all" ? t("all") : tStatus(f)} ({count})
            </Link>
          );
        })}
        <Link
          href={filterHref(status, !verifiedOnly)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
            verifiedOnly ? "bg-accent text-ink" : "bg-muted text-ink hover:bg-line",
          )}
        >
          {t("verifiedOnly")}
        </Link>
      </nav>
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-subtle">{t("sortLabel")}</span>
        {(["time", "rating"] as const).map((so) => (
          <Link
            key={so}
            href={filterHref(status, verifiedOnly, so)}
            aria-current={sort === so ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1 font-semibold",
              sort === so ? "bg-ink text-white" : "text-ink underline underline-offset-4",
            )}
          >
            {t(`sort.${so}`)}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-card bg-muted p-8 text-ink-soft">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex h-full flex-col overflow-hidden rounded-card border border-line transition-colors hover:border-ink"
            >
              <Link
                href={{
                  pathname: `/organizer/events/${event.id}/registrations/${r.id}`,
                  query: query(status, verifiedOnly, sort),
                }}
                className="flex flex-1 flex-col"
              >
                <div className="aspect-[4/3] bg-muted">
                  {r.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-ink">
                      {r.vehicle ? `${r.vehicle.make} ${r.vehicle.model}` : "—"}
                    </p>
                    <span className="flex flex-col items-end gap-1">
                      <RegistrationStatusBadge status={r.effectiveStatus} />
                      {r.draftStatus ? (
                        <span className="text-xs font-semibold text-subtle">{t("draftBadge")}</span>
                      ) : null}
                      {r.info_requested_at && (r.status === "pending" || r.status === "waitlist") ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            r.info_replied_at ? "bg-success-soft text-success" : "bg-muted text-ink",
                          )}
                        >
                          {r.info_replied_at ? t("infoReplied") : t("infoWaiting")}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <p className="text-sm text-subtle">
                    {[r.vehicle?.year, r.vehicle ? tCat(`categories.${r.vehicle.category}`) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-sm text-ink-soft">
                    <span>@{r.applicant?.username ?? "—"}</span>
                    {r.applicant?.verified_at ? <Badge>Verified</Badge> : null}
                    <span className="ml-auto text-xs text-subtle">
                      {formatDateTime(r.created_at, locale, event.timezone)}
                    </span>
                  </div>
                </div>
              </Link>
              {r.status !== "cancelled" ? (
                <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
                  <StarRating registrationId={r.id} initial={r.rating} size="sm" />
                  {r.effectiveStatus === "pending" ? <QuickApprove registrationId={r.id} /> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
