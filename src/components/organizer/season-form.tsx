"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { createSeason, type SeasonFormState } from "@/lib/organizer/actions";

const initial: SeasonFormState = { status: "idle" };

export function SeasonForm() {
  const t = useTranslations("Organizer");
  const locale = useLocale();
  const [state, action, pending] = useActionState(createSeason, initial);
  const nextYear = new Date().getFullYear() + 1;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      {state.status === "error" ? (
        <Alert tone="error">{t(`seasonErrors.${state.error}`)}</Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field
          label={t("seasonNameLabel")}
          name="name"
          required
          maxLength={80}
          defaultValue={`${t("seasonDefaultName")} ${nextYear}`}
        />
        <Field
          label={t("seasonYearLabel")}
          name="year"
          type="number"
          inputMode="numeric"
          min={2000}
          max={2100}
          required
          defaultValue={String(nextYear)}
        />
      </div>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {t("seasonCreate")}
        </Button>
      </div>
    </form>
  );
}
