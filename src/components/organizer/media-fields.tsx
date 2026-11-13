"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/** Sekce formuláře eventu: přijímáme média? Neomezeně, nebo s limitem míst. */
export function MediaFields({
  enabled,
  capacity,
  error,
}: {
  enabled: boolean;
  capacity: string;
  error?: string;
}) {
  const t = useTranslations("EventForm");
  const [on, setOn] = useState(enabled);
  const [limited, setLimited] = useState(capacity !== "");

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          name="media_enabled"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
        />
        <span>
          <span className="font-semibold">{t("mediaEnabledLabel")}</span>
          <span className="block text-ink-soft">{t("mediaEnabledHint")}</span>
        </span>
      </label>
      {on ? (
        <fieldset className="flex flex-col gap-3 rounded-card bg-muted p-4">
          <legend className="sr-only">{t("mediaLimitLegend")}</legend>
          <div className="flex flex-wrap gap-2">
            {(["unlimited", "limited"] as const).map((mode) => {
              const active = (mode === "limited") === limited;
              return (
                <label
                  key={mode}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold",
                    active ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink",
                  )}
                >
                  <input
                    type="radio"
                    name="media_limit"
                    value={mode}
                    checked={active}
                    onChange={() => setLimited(mode === "limited")}
                    className="sr-only"
                  />
                  {t(`mediaLimit.${mode}`)}
                </label>
              );
            })}
          </div>
          {limited ? (
            <Field
              label={t("mediaCapacityLabel")}
              name="media_capacity"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              required
              defaultValue={capacity}
              error={error}
            />
          ) : null}
        </fieldset>
      ) : null}
    </div>
  );
}
