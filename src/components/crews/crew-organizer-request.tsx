"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { requestCrewOrganizer, type CrewError } from "@/lib/crews/actions";
import { switchOrganizer } from "@/lib/organizer/actions";
import { Button } from "@/components/ui/button";

/** Pro správce crew: požádat o pořádání / žádost odeslána / spravovat srazy. */
export function CrewOrganizerRequest({
  crewId,
  organizerId,
  requested,
}: {
  crewId: string;
  organizerId: string | null;
  requested: boolean;
}) {
  const t = useTranslations("Crews");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<CrewError | null>(null);

  if (organizerId) {
    return (
      <Button
        variant="light"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await switchOrganizer(organizerId);
            router.push("/organizer");
          })
        }
      >
        {t("manageMeets")}
      </Button>
    );
  }
  if (requested) {
    return <p className="text-sm text-night-subtle">{t("organizerRequested")}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outlineDark"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await requestCrewOrganizer(crewId);
            if (!res.ok) setError(res.error);
            router.refresh();
          });
        }}
      >
        {t("requestOrganizer")}
      </Button>
      <p className="text-xs text-night-subtle">{t("requestOrganizerHint")}</p>
      {error ? <p className="text-sm text-accent">{t(`errors.${error}`)}</p> : null}
    </div>
  );
}
