import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/dates";
import { getMyEvent, getMyOrganizer } from "@/lib/data/events";
import {
  listEventRegistrations,
  type RegistrationStatus,
} from "@/lib/data/registrations";
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
  const { rows, counts } = await listEventRegistrations(event.id, {
    status,
    verifiedOnly,
    verifiedFirst: event.verified_priority,
  });

  const filterHref = (s: RegistrationStatus | "all", v: boolean) => ({
    pathname: `/organizer/events/${event.id}/registrations`,
    query: { status: s, ...(v ? { verified: "1" } : {}) },
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

      {rows.length === 0 ? (
        <p className="rounded-card bg-muted p-8 text-ink-soft">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/organizer/events/${event.id}/registrations/${r.id}`}
                className="flex h-full flex-col overflow-hidden rounded-card border border-line transition-colors hover:border-ink"
              >
                <div className="aspect-[4/3] bg-muted">
                  {r.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-ink">
                      {r.vehicle ? `${r.vehicle.make} ${r.vehicle.model}` : "—"}
                    </p>
                    <RegistrationStatusBadge status={r.status} />
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
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
