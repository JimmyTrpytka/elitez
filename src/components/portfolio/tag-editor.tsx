"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { listMemberVehicles, setPortfolioTags, type PortfolioError } from "@/lib/portfolio/actions";

type Tags = { eventId: string | null; eventTitle: string | null; vehicleId: string | null; vehicleName: string | null };

/** Označení práce: event (kde jsem byl schválený jako média) a auto člena. */
export function TagEditor({
  itemId,
  tags,
  mediaEvents,
}: {
  itemId: string;
  tags: Tags;
  mediaEvents: Array<{ id: string; title: string }>;
}) {
  const t = useTranslations("Portfolio");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState(tags.eventId ?? "");
  const [vehicle, setVehicle] = useState<{ id: string; name: string } | null>(
    tags.vehicleId ? { id: tags.vehicleId, name: tags.vehicleName ?? "" } : null,
  );
  const [username, setUsername] = useState("");
  const [found, setFound] = useState<Array<{ id: string; name: string }> | null>(null);
  const [error, setError] = useState<PortfolioError | null>(null);
  const [pending, startTransition] = useTransition();

  // Event, který už není mezi schválenými (např. zrušená akreditace), necháme ve výběru
  const events =
    tags.eventId && !mediaEvents.some((e) => e.id === tags.eventId)
      ? [{ id: tags.eventId, title: tags.eventTitle ?? "—" }, ...mediaEvents]
      : mediaEvents;

  if (!open) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        {tags.eventTitle ? <p className="text-ink-soft">📍 {tags.eventTitle}</p> : null}
        {tags.vehicleName ? <p className="text-ink-soft">🚗 {tags.vehicleName}</p> : null}
        <button type="button" onClick={() => setOpen(true)} className="self-start font-semibold text-ink underline underline-offset-4">
          {tags.eventId || tags.vehicleId ? t("tagsEdit") : t("tagsAdd")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-control bg-muted p-3 text-sm">
      <label className="flex flex-col gap-1 font-medium text-ink">
        {t("tagEventLabel")}
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="h-10 rounded-control border border-line bg-surface px-2 text-sm"
        >
          <option value="">{t("tagNone")}</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        {!mediaEvents.length ? <span className="font-normal text-subtle">{t("tagEventHint")}</span> : null}
      </label>

      <div className="flex flex-col gap-1">
        <span className="font-medium text-ink">{t("tagVehicleLabel")}</span>
        {vehicle ? (
          <p className="flex flex-wrap items-center gap-2 text-ink">
            🚗 {vehicle.name}
            <button type="button" onClick={() => setVehicle(null)} className="font-semibold underline underline-offset-4">
              {t("tagRemove")}
            </button>
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@uzivatel"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-label={t("tagOwnerLabel")}
                className="h-10 min-w-0 flex-1 rounded-control border border-line bg-surface px-3 text-sm"
              />
              <button
                type="button"
                disabled={pending || !username.trim()}
                onClick={() =>
                  startTransition(async () => {
                    setFound(await listMemberVehicles(username));
                  })
                }
                className="h-10 rounded-full border border-line bg-surface px-4 font-semibold text-ink disabled:opacity-50"
              >
                {t("tagFind")}
              </button>
            </div>
            {found ? (
              found.length ? (
                <ul className="flex flex-col gap-1">
                  {found.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setVehicle(v);
                          setFound(null);
                        }}
                        className="text-left font-semibold text-ink underline underline-offset-4"
                      >
                        {v.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-subtle">{t("tagNoVehicles")}</p>
              )
            ) : null}
          </>
        )}
      </div>

      {error ? <p className="text-danger">{t(`errors.${error}`)}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await setPortfolioTags({ id: itemId, eventId: eventId || null, vehicleId: vehicle?.id ?? null });
              if (res.ok) {
                setOpen(false);
                router.refresh();
              } else setError(res.error);
            })
          }
          className="h-10 rounded-full bg-ink px-4 font-semibold text-white disabled:opacity-50"
        >
          {pending ? tCommon("saving") : tCommon("save")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-10 px-2 font-semibold text-ink">
          {tCommon("cancel")}
        </button>
      </div>
    </div>
  );
}
