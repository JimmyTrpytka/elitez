"use client";

import { useKeepValuesSubmit } from "@/components/ui/use-keep-values-submit";
import { useActionState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { useScrollToError } from "@/components/ui/use-scroll-to-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { createSeason, type SeasonFormState } from "@/lib/organizer/actions";

const initial: SeasonFormState = { status: "idle" };

export function SeasonForm() {
  const t = useTranslations("Organizer");
  const locale = useLocale();
  const [state, action, pending] = useActionState(createSeason, initial);
  const submit = useKeepValuesSubmit(action);
  const formRef = useRef<HTMLFormElement>(null);
  // Chyba u konkrétního pole: ukáže se pod ním a stránka se k němu posune
  const fieldOf: Record<string, string> = { nameRequired: "name", yearInvalid: "year" };
  const errField = state.status === "error" ? fieldOf[state.error] : undefined;
  const errMessage = state.status === "error" ? t(`seasonErrors.${state.error}`) : undefined;
  const errorFor = (name: string) => (errField === name ? errMessage : undefined);
  useScrollToError(state, errField, formRef);
  const nextYear = new Date().getFullYear() + 1;

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      {state.status === "error" && !errField ? (
        <Alert tone="error">{t(`seasonErrors.${state.error}`)}</Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field
          label={t("seasonNameLabel")}
          name="name"
          error={errorFor("name")}
          required
          maxLength={80}
          defaultValue={`${t("seasonDefaultName")} ${nextYear}`}
        />
        <Field
          label={t("seasonYearLabel")}
          name="year"
          error={errorFor("year")}
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
