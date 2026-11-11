import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/dates";
import { getMyEvent, getMyOrganizer } from "@/lib/data/events";
import { getEmailQueueCount, getSegmentCounts, listBroadcasts } from "@/lib/data/broadcasts";
import { PageShell } from "@/components/page-shell";
import { BroadcastForm } from "@/components/organizer/broadcast-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Broadcast");
  return { title: t("title"), robots: { index: false } };
}

export default async function MessagesPage({
  params,
}: PageProps<"/[locale]/organizer/events/[id]/messages">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-2xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}
    >
      <MessagesContent params={params} />
    </Suspense>
  );
}

async function MessagesContent({
  params,
}: {
  params: PageProps<"/[locale]/organizer/events/[id]/messages">["params"];
}) {
  const { id } = await params;
  const [t, locale, organizer] = await Promise.all([
    getTranslations("Broadcast"),
    getLocale(),
    getMyOrganizer(),
  ]);
  if (!organizer) notFound();
  const event = await getMyEvent(organizer.id, id);
  if (!event) notFound();
  const [counts, history, queued] = await Promise.all([
    getSegmentCounts(event.id),
    listBroadcasts(event.id),
    getEmailQueueCount(event.id),
  ]);

  return (
    <PageShell
      title={t("title")}
      subtitle={
        <Link href={`/organizer/events/${event.id}`} className={textLinkClass}>
          ← {event.title}
        </Link>
      }
    >
      <div className="flex flex-col gap-6">
        {queued > 0 ? <Alert tone="info">{t("queued", { count: queued })}</Alert> : null}
        <Card>
          <BroadcastForm eventId={event.id} eventTitle={event.title} counts={counts} />
        </Card>

        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("historyTitle")}</h2>
          {history.length === 0 ? (
            <p className="text-ink-soft">{t("historyEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {history.map((b) => (
                <li key={b.id} className="rounded-card border border-line p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-ink">{b.subject}</p>
                    <span className="text-xs text-subtle">
                      {formatDateTime(b.created_at, locale, event.timezone)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-subtle">
                    {t(`segments.${b.segment}`)} · {t("people", { count: b.recipient_count })}
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-ink">
                      {t("showText")}
                    </summary>
                    <p className="mt-2 whitespace-pre-line text-ink-soft">{b.body}</p>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}
