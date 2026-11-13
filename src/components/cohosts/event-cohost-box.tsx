import { getTranslations } from "next-intl/server";
import type { EventView } from "@/lib/data/events";
import type { EventCohost } from "@/lib/data/cohosts";
import type { MyOrganizerOption } from "@/lib/organizer/current";
import { hasEnded } from "@/lib/dates";
import { CohostButtons } from "./cohost-buttons";

/**
 * Na detailu eventu pro lidi, kteří spravují JINÉHO pořadatele:
 * požádat o spolupořádání / přijmout pozvánku / stav.
 */
export async function EventCohostBox({
  event,
  myOrganizers,
  cohosts,
}: {
  event: EventView;
  myOrganizers: MyOrganizerOption[];
  cohosts: EventCohost[];
}) {
  const others = myOrganizers.filter((o) => o.id !== event.organizer_id);
  const eligible =
    event.status === "published" && (event.access === "public" || event.access === "verified_only") && !hasEnded(event.ends_at);
  if (!others.length || myOrganizers.some((o) => o.id === event.organizer_id)) return null;
  const relevant = others.filter((o) => eligible || cohosts.some((c) => c.organizerId === o.id && c.status !== "declined"));
  if (!relevant.length) return null;
  const t = await getTranslations("Cohosts");

  return (
    <div className="mb-8 flex flex-col gap-3 rounded-card bg-night-soft p-5 ring-1 ring-white/10 sm:p-6">
      <p className="font-semibold text-white">{t("boxTitle")}</p>
      <ul className="flex flex-col gap-3">
        {relevant.map((o) => {
          const row = cohosts.find((c) => c.organizerId === o.id && c.status !== "declined");
          const mode = !row ? "none" : row.status === "accepted" ? "accepted" : row.invitedByHost ? "incoming" : "outgoing";
          return (
            <li key={o.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-white/80">
                <span className="font-semibold text-white">{o.name}</span> · {t(`boxStatus.${mode}`)}
              </p>
              {mode === "none" && !eligible ? null : (
                <CohostButtons
                  eventId={event.id}
                  organizerId={o.id}
                  mode={mode}
                  dark
                  requestLabel={t("requestAs", { name: o.name })}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
