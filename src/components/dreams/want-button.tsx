"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { toggleWantVehicle, type DreamErrorKey } from "@/lib/dreams/actions";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** „Tohle chci!“ – přidá auto do Garáže snů + počet lidí, kteří ho tam mají. */
export function WantButton({
  vehicleId,
  initialWanted,
  initialDreamers,
  mode,
}: {
  vehicleId: string;
  initialWanted: boolean;
  initialDreamers: number;
  mode: "active" | "guest" | "own";
}) {
  const t = useTranslations("Dreams");
  const [wanted, setWanted] = useState(initialWanted);
  const [dreamers, setDreamers] = useState(initialDreamers);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<DreamErrorKey | null>(null);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(id);
  }, [error]);

  const counter =
    dreamers > 0 ? (
      <span className="text-sm text-night-subtle">
        <span aria-hidden>💭 </span>
        {t("inDreamsOf", { count: dreamers })}
      </span>
    ) : null;

  if (mode === "own") return counter;

  return (
    <div className="relative flex flex-wrap items-center gap-4">
      {mode === "guest" ? (
        <Link href="/login" className={buttonClasses("outlineDark")}>
          {t("want")}
        </Link>
      ) : (
        <button
          type="button"
          disabled={pending}
          aria-pressed={wanted}
          onClick={() => {
            const prev = { wanted, dreamers };
            setWanted(!wanted);
            setDreamers(Math.max(0, dreamers + (wanted ? -1 : 1)));
            setError(null);
            startTransition(async () => {
              const res = await toggleWantVehicle(vehicleId);
              if (res.ok) {
                setWanted(res.wanted);
                setDreamers(res.dreamers);
              } else {
                setWanted(prev.wanted);
                setDreamers(prev.dreamers);
                setError(res.error);
              }
            });
          }}
          className={cn(
            buttonClasses(wanted ? "primary" : "outlineDark"),
            "cursor-pointer disabled:cursor-wait",
          )}
        >
          {wanted ? t("wanted") : t("want")}
        </button>
      )}
      {counter}
      {error ? (
        <span role="status" className="absolute top-full left-0 z-20 mt-2 w-64 rounded-control bg-white p-3 text-sm text-ink shadow-xl">
          {t(`errors.${error}`)}
        </span>
      ) : null}
    </div>
  );
}
