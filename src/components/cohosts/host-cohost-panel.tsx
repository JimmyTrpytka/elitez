"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inviteCohost, type CohostErrorKey } from "@/lib/cohosts/actions";
import type { EventCohost } from "@/lib/data/cohosts";
import { CohostButtons } from "./cohost-buttons";

/** Karta „Spolupořadatelé eventu“ u hlavního pořadatele: pozvat, potvrdit žádosti, ukončit. */
export function HostCohostPanel({
  eventId,
  eligible,
  cohosts,
  options,
}: {
  eventId: string;
  /** Event je zveřejněný a veřejný / pro Verified */
  eligible: boolean;
  cohosts: EventCohost[];
  /** Pořadatelé, které jde pozvat */
  options: Array<{ slug: string; name: string }>;
}) {
  const t = useTranslations("Cohosts");
  const tErrors = useTranslations("CohostErrors");
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<CohostErrorKey | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const active = cohosts.filter((c) => c.status !== "declined");
  const taken = new Set(active.map((c) => c.slug));
  const free = options.filter((o) => !taken.has(o.slug));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">{t("hostIntro")}</p>
      {active.length ? (
        <ul className="flex flex-col gap-2">
          {active.map((c) => {
            const mode = c.status === "accepted" ? "accepted" : c.invitedByHost ? "outgoing" : "incoming";
            return (
              <li key={c.organizerId} className="flex flex-col gap-2 rounded-control bg-muted p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/o/${c.slug}`} className="font-semibold text-ink underline underline-offset-4">
                    {c.name}
                  </Link>
                  <p className="text-sm text-ink-soft">{t(`hostStatus.${mode}`)}</p>
                </div>
                <CohostButtons eventId={eventId} organizerId={c.organizerId} mode={mode} />
              </li>
            );
          })}
        </ul>
      ) : null}
      {eligible ? (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!slug) return;
            setError(null);
            setInfo(null);
            startTransition(async () => {
              const res = await inviteCohost(eventId, slug);
              if (res.ok) {
                setInfo(res.status === "accepted" ? t("invitedAccepted") : t("invitedPending"));
                setSlug("");
                router.refresh();
              } else setError(res.error);
            });
          }}
        >
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-ink">
            {t("inviteLabel")}
            <select
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="h-12 rounded-control border border-line bg-surface px-3 text-base text-ink"
            >
              <option value="">{t("invitePlaceholder")}</option>
              {free.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={pending || !slug}>
            {t("invite")}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-subtle">{t("notEligible")}</p>
      )}
      {error ? <Alert tone="error">{tErrors(error)}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}
    </div>
  );
}
