import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatEventDates } from "@/lib/dates";
import { getMyEvent, getMyOrganizer } from "@/lib/data/events";
import { listEventRegistrations } from "@/lib/data/registrations";
import { PrintButton } from "@/components/print-button";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Export");
  return { title: t("printTitle"), robots: { index: false } };
}

export default async function PrintPage({
  params,
}: PageProps<"/[locale]/organizer/events/[id]/print">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense fallback={<p className="px-4 py-14 text-subtle">{tAuth("loading")}</p>}>
      <PrintContent params={params} />
    </Suspense>
  );
}

/** Tisknutelný seznam schválených (papírová záloha pro den akce). */
async function PrintContent({
  params,
}: {
  params: PageProps<"/[locale]/organizer/events/[id]/print">["params"];
}) {
  const { id } = await params;
  const [t, locale, organizer] = await Promise.all([
    getTranslations("Export"),
    getLocale(),
    getMyOrganizer(),
  ]);
  if (!organizer) notFound();
  const event = await getMyEvent(organizer.id, id);
  if (!event) notFound();
  const { rows } = await listEventRegistrations(event.id, {
    status: "approved",
    verifiedFirst: false,
  });
  const sorted = [...rows].sort((a, b) =>
    `${a.vehicle?.make ?? ""} ${a.vehicle?.model ?? ""}`.localeCompare(
      `${b.vehicle?.make ?? ""} ${b.vehicle?.model ?? ""}`,
      locale,
    ),
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/organizer/events/${event.id}`} className={textLinkClass}>
          ← {event.title}
        </Link>
        <PrintButton label={t("print")} />
      </div>

      <h1 className="text-2xl font-bold">{event.title}</h1>
      <p className="mb-4 text-sm text-ink-soft">
        {formatEventDates(event.starts_at, event.ends_at, locale, event.timezone)}
        {event.venue_name ? ` · ${event.venue_name}` : ""} · {t("approvedCount", { count: sorted.length })}
      </p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-ink text-left">
            <th className="w-10 py-2 pr-2">#</th>
            <th className="w-10 py-2 pr-2">{t("colArrived")}</th>
            <th className="py-2 pr-2">{t("colVehicle")}</th>
            <th className="py-2 pr-2">{t("colName")}</th>
            <th className="py-2 pr-2">{t("colPhone")}</th>
            <th className="py-2">{t("colVerified")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.id} className="break-inside-avoid border-b border-line">
              <td className="py-2 pr-2 text-subtle">{i + 1}</td>
              <td className="py-2 pr-2">
                <span className="inline-block h-4 w-4 border-2 border-ink" aria-hidden />
              </td>
              <td className="py-2 pr-2 font-semibold">
                {r.vehicle ? `${r.vehicle.make} ${r.vehicle.model}` : "—"}
                {r.vehicle?.year ? ` (${r.vehicle.year})` : ""}
              </td>
              <td className="py-2 pr-2">
                {r.applicant?.display_name ?? ""}
                {r.applicant?.username ? (
                  <span className="text-subtle"> @{r.applicant.username}</span>
                ) : null}
              </td>
              <td className="py-2 pr-2 whitespace-nowrap">{r.contact_phone}</td>
              <td className="py-2">{r.applicant?.verified_at ? "✓" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 ? <p className="mt-6 text-ink-soft">{t("printEmpty")}</p> : null}
    </div>
  );
}
