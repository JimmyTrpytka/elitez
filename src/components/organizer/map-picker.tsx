"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MapView } from "@/components/map/map-view";

/** Výběr místa eventu kliknutím do mapy; hodnoty jdou do formuláře skrytými poli. */
export function MapPicker({
  initial,
}: {
  initial: { lat: number; lng: number } | null;
}) {
  const t = useTranslations("EventForm");
  const [point, setPoint] = useState(initial);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-ink">{t("mapLabel")}</p>
      <MapView point={point} onPick={setPoint} ariaLabel={t("mapLabel")} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-subtle">
        <span>
          {point
            ? t("mapPicked", { lat: point.lat.toFixed(5), lng: point.lng.toFixed(5) })
            : t("mapHint")}
        </span>
        {point ? (
          <button
            type="button"
            onClick={() => setPoint(null)}
            className="font-semibold text-ink underline underline-offset-4"
          >
            {t("mapClear")}
          </button>
        ) : null}
      </div>
      <input type="hidden" name="lat" value={point ? point.lat.toFixed(6) : ""} />
      <input type="hidden" name="lng" value={point ? point.lng.toFixed(6) : ""} />
    </div>
  );
}
