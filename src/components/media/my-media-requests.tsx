import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatEventDates } from "@/lib/dates";
import { listMyMediaRequests, mediaStatus } from "@/lib/data/media";
import { cn } from "@/lib/cn";

const STATUS_STYLE = {
  pending: "bg-muted text-ink",
  approved: "bg-accent text-ink",
  rejected: "bg-danger-soft text-danger",
  cancelled: "bg-muted text-subtle line-through",
} as const;

/** Moje žádosti jako média (v Moje registrace). Zrušit jde na stránce eventu. */
export async function MyMediaRequests() {
  const [t, locale, items] = await Promise.all([getTranslations("Media"), getLocale(), listMyMediaRequests()]);
  if (!items.length) return null;
  return (
    <section className="mt-12">
      <h2 className="mb-4 font-display text-3xl font-extrabold text-ink uppercase">{t("myTitle")}</h2>
      <ul className="flex flex-col gap-3">
        {items.map((r) => {
          const status = mediaStatus(r.status);
          return (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-card border border-line p-5">
              <div className="min-w-0">
                {r.event ? (
                  <Link href={`/e/${r.event.slug}`} className="text-lg font-semibold text-ink hover:underline">
                    {r.event.title}
                  </Link>
                ) : null}
                {r.event ? (
                  <p className="text-sm text-ink-soft">
                    {formatEventDates(r.event.starts_at, r.event.ends_at, locale, r.event.timezone)}
                  </p>
                ) : null}
                {r.decision_message ? (
                  <p className="mt-2 text-sm text-ink">
                    {t("organizerMessage")}: {r.decision_message}
                  </p>
                ) : null}
              </div>
              <span className={cn("rounded-full px-3 py-1 text-xs font-bold", STATUS_STYLE[status])}>
                📸 {t(`status.${status}`)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
