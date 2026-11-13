import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatEventDates, hasEnded } from "@/lib/dates";
import { listMyCohosting } from "@/lib/data/cohosts";
import { CohostButtons } from "./cohost-buttons";

/** Sekce „Spolupořádání“ v Pořadatel: pozvánky, odeslané žádosti, spolupořádané eventy. */
export async function MyCohosting({ organizerIds }: { organizerIds: string[] }) {
  const [t, locale, rows] = await Promise.all([
    getTranslations("Cohosts"),
    getLocale(),
    listMyCohosting(organizerIds),
  ]);
  const shown = rows.filter((r) => r.status !== "accepted" || !hasEnded(r.endsAt));
  if (!shown.length) return null;
  const many = new Set(shown.map((r) => r.organizerId)).size > 1;

  return (
    <section id="spoluporadani" className="scroll-mt-24">
      <h2 className="mb-4 text-xl font-semibold">{t("dashboardTitle")}</h2>
      <ul className="flex flex-col gap-3">
        {shown.map((r) => {
          const mode = r.status === "accepted" ? "accepted" : r.invitedByHost ? "incoming" : "outgoing";
          return (
            <li
              key={`${r.eventId}-${r.organizerId}`}
              className="flex flex-col gap-3 rounded-card border border-line p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Link href={`/e/${r.eventSlug}`} className="font-semibold text-ink underline underline-offset-4">
                  {r.eventTitle}
                </Link>
                <p className="text-sm text-ink-soft">
                  {formatEventDates(r.startsAt, r.endsAt, locale, r.timezone)}
                  {many ? ` · ${r.organizerName}` : ""}
                </p>
                <p className="text-sm font-semibold text-ink">{t(`boxStatus.${mode}`)}</p>
              </div>
              <CohostButtons eventId={r.eventId} organizerId={r.organizerId} mode={mode} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
