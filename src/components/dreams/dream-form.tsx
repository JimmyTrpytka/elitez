"use client";

import { useActionState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useKeepValuesSubmit } from "@/components/ui/use-keep-values-submit";
import { useScrollToError } from "@/components/ui/use-scroll-to-error";
import { Alert } from "@/components/ui/alert";
import { StickyActions } from "@/components/ui/sticky-actions";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/textarea";
import { saveDream, type DreamFormState } from "@/lib/dreams/actions";
import { LIMITS } from "@/lib/validation";
import { DREAM_STATUS_ICON } from "./dream-status";

export type DreamFormValues = {
  id?: string;
  make: string;
  model: string;
  year_from: string;
  year_to: string;
  note: string;
  status: "dreaming" | "planning" | "searching";
  visibility: "public" | "private";
};

const initial: DreamFormState = { status: "idle" };

export function DreamForm({ values }: { values: DreamFormValues }) {
  const t = useTranslations("Dreams");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [state, action, pending] = useActionState(saveDream, initial);
  const submit = useKeepValuesSubmit(action);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldOf: Record<string, string> = {
    makeRequired: "make",
    modelRequired: "model",
    yearInvalid: "year_from",
    yearOrder: "year_to",
  };
  const errField = state.status === "error" ? fieldOf[state.error] : undefined;
  const errMessage = state.status === "error" ? t(`errors.${state.error}`) : undefined;
  const errorFor = (name: string) => (errField === name ? errMessage : undefined);
  useScrollToError(state, errField, formRef);
  const maxYear = new Date().getFullYear() + 1;

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {state.status === "error" && !errField ? <Alert tone="error">{errMessage}</Alert> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("makeLabel")}
          name="make"
          required
          maxLength={LIMITS.make}
          placeholder="Porsche"
          defaultValue={values.make}
          error={errorFor("make")}
        />
        <Field
          label={t("modelLabel")}
          name="model"
          required
          maxLength={LIMITS.model}
          placeholder="911 (964)"
          defaultValue={values.model}
          error={errorFor("model")}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("yearFromLabel")}
          name="year_from"
          type="number"
          inputMode="numeric"
          min={1885}
          max={maxYear}
          defaultValue={values.year_from}
          error={errorFor("year_from")}
        />
        <Field
          label={t("yearToLabel")}
          name="year_to"
          type="number"
          inputMode="numeric"
          min={1885}
          max={maxYear}
          defaultValue={values.year_to}
          error={errorFor("year_to")}
          hint={t("yearHint")}
        />
      </div>

      <ChoiceCards
        legend={t("statusLabel")}
        name="status"
        defaultValue={values.status}
        choices={(["dreaming", "planning", "searching"] as const).map((s) => ({
          value: s,
          title: `${DREAM_STATUS_ICON[s]} ${t(`status.${s}`)}`,
          description: t(`statusText.${s}`),
        }))}
      />

      <TextareaField
        label={t("noteLabel")}
        name="note"
        rows={3}
        maxLength={500}
        defaultValue={values.note}
        hint={t("noteHint")}
      />

      <ChoiceCards
        legend={t("visibilityLabel")}
        name="visibility"
        defaultValue={values.visibility}
        choices={[
          { value: "public", title: tCommon("visibilityPublic"), description: t("visibilityPublicText") },
          { value: "private", title: tCommon("visibilityPrivate"), description: t("visibilityPrivateText") },
        ]}
      />

      <StickyActions>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? tCommon("saving") : values.id ? tCommon("save") : t("createSubmit")}
        </Button>
      </StickyActions>
    </form>
  );
}
