"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setRegistrationRating } from "@/lib/registrations/actions";
import { cn } from "@/lib/cn";

/** Interní hodnocení přihlášky 1–5 hvězd. Klik na stejnou hvězdu hodnocení smaže. */
export function StarRating({
  registrationId,
  initial,
  size = "md",
}: {
  registrationId: string;
  initial: number | null;
  size?: "sm" | "md";
}) {
  const t = useTranslations("Applications");
  const [rating, setRating] = useState<number | null>(initial);
  const [hover, setHover] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();

  function choose(value: number) {
    const next = rating === value ? null : value;
    const previous = rating;
    setRating(next);
    setFailed(false);
    startTransition(async () => {
      const result = await setRegistrationRating(registrationId, next);
      if (!result.ok) {
        setRating(previous);
        setFailed(true);
      }
    });
  }

  const shown = hover ?? rating ?? 0;
  return (
    <div
      className="inline-flex items-center"
      role="group"
      aria-label={t("ratingLabel")}
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            choose(n);
          }}
          onMouseEnter={() => setHover(n)}
          aria-label={t("ratingStar", { count: n })}
          aria-pressed={rating === n}
          className={cn(
            "leading-none transition-transform hover:scale-110",
            size === "sm" ? "px-0.5 text-xl" : "px-1 text-3xl",
            n <= shown ? "text-amber-500" : "text-line",
          )}
        >
          ★
        </button>
      ))}
      {failed ? <span className="ml-2 text-xs text-danger">{t("ratingFailed")}</span> : null}
    </div>
  );
}
