"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { FieldMessage, fieldBorder } from "./field-message";

/**
 * Datum a čas jako dvě samostatná pole (místo jednoho „datetime-local“,
 * které v prohlížeči samo doplní aktuální čas a snadno se přehlédne).
 * Do formuláře posílá skryté pole `name` ve tvaru „2027-05-15T10:00“
 * (prázdné, když není vyplněné datum).
 */
export function DateTimeField({
  label,
  name,
  defaultValue,
  defaultTime,
  required,
  error,
  hint,
}: {
  label: string;
  name: string;
  /** „YYYY-MM-DDTHH:mm“ nebo prázdné */
  defaultValue: string;
  /** Čas, který se předvyplní k novému datu, např. „10:00“ */
  defaultTime: string;
  required?: boolean;
  error?: string;
  /** Nápověda pod polem (např. že je nepovinné) */
  hint?: string;
}) {
  const t = useTranslations("Common");
  const [date, setDate] = useState(defaultValue.slice(0, 10));
  const [time, setTime] = useState(defaultValue.slice(11, 16) || defaultTime);
  const dateId = `${name}-date`;
  const timeId = `${name}-time`;

  return (
    <fieldset className="flex flex-col gap-1.5" data-field={name}>
      <legend className="mb-1.5 text-sm font-medium text-ink">{label}</legend>
      <div className={cn("grid gap-2", required ? "grid-cols-[1fr_7.5rem]" : "grid-cols-[1fr_7.5rem_auto]")}>
        <label htmlFor={dateId} className="sr-only">
          {t("date")}
        </label>
        <input
          id={dateId}
          type="date"
          value={date}
          required={required}
          onChange={(e) => setDate(e.target.value)}
          className={cn(
            "h-12 min-w-0 rounded-control border bg-surface px-3 text-base text-ink focus:outline-none",
            fieldBorder(error),
          )}
          aria-invalid={error ? true : undefined}
        />
        <label htmlFor={timeId} className="sr-only">
          {t("time")}
        </label>
        <input
          id={timeId}
          type="time"
          value={time}
          required={Boolean(date)}
          step={300}
          onChange={(e) => setTime(e.target.value)}
          className={cn(
            "h-12 min-w-0 rounded-control border bg-surface px-3 text-base text-ink focus:outline-none",
            fieldBorder(error),
          )}
          aria-invalid={error ? true : undefined}
        />
        {/* Nepovinné datum jde smazat (Safari to v kalendáři neumí) */}
        {!required ? (
          <button
            type="button"
            onClick={() => setDate("")}
            disabled={!date}
            aria-label={t("clearDate")}
            title={t("clearDate")}
            className="inline-flex h-12 w-12 items-center justify-center rounded-control border border-line text-xl text-ink-soft transition-colors hover:bg-muted disabled:opacity-30"
          >
            ×
          </button>
        ) : null}
      </div>
      <FieldMessage id={`${name}-message`} error={error} hint={hint} />
      <input type="hidden" name={name} value={date && time ? `${date}T${time.slice(0, 5)}` : ""} />
    </fieldset>
  );
}
