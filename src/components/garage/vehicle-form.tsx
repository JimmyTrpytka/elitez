"use client";

import { useKeepValuesSubmit } from "@/components/ui/use-keep-values-submit";
import { useActionState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { useScrollToError } from "@/components/ui/use-scroll-to-error";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { TextareaField } from "@/components/ui/textarea";
import { countryOptions } from "@/lib/countries";
import { saveVehicle, type VehicleFormState } from "@/lib/garage/actions";
import { Constants } from "@/lib/supabase/database.types";
import { LIMITS } from "@/lib/validation";

export type VehicleFormValues = {
  id?: string;
  type: string;
  category: string;
  make: string;
  model: string;
  year: string;
  engine: string;
  power_hp: string;
  description: string;
  story: string;
  country: string;
  acquired_on: string;
  visibility: "public" | "private";
};

const initial: VehicleFormState = { status: "idle" };

export function VehicleForm({ values }: { values: VehicleFormValues }) {
  const t = useTranslations("Vehicle");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [state, action, pending] = useActionState(saveVehicle, initial);
  const submit = useKeepValuesSubmit(action);
  const formRef = useRef<HTMLFormElement>(null);
  // Chyba u konkrétního pole: ukáže se pod ním a stránka se k němu posune
  const fieldOf: Record<string, string> = { makeRequired: "make", modelRequired: "model", yearInvalid: "year", powerInvalid: "power_hp", countryInvalid: "country", dateInvalid: "acquired_on", categoryInvalid: "category" };
  const errField = state.status === "error" ? fieldOf[state.error] : undefined;
  const errMessage = state.status === "error" ? t(`errors.${state.error}`) : undefined;
  const errorFor = (name: string) => (errField === name ? errMessage : undefined);
  useScrollToError(state, errField, formRef);
  const countries = countryOptions(locale);
  const maxYear = new Date().getFullYear() + 1;

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {state.status === "error" && !errField ? (
        <Alert tone="error">{t(`errors.${state.error}`)}</Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label={t("typeLabel")} name="type" defaultValue={values.type}>
          {Constants.public.Enums.vehicle_type.map((v) => (
            <option key={v} value={v}>
              {t(`types.${v}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t("categoryLabel")}
          name="category"
          error={errorFor("category")}
          defaultValue={values.category}
        >
          {Constants.public.Enums.vehicle_category.map((v) => (
            <option key={v} value={v}>
              {t(`categories.${v}`)}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("makeLabel")}
          name="make"
          error={errorFor("make")}
          required
          maxLength={LIMITS.make}
          placeholder="BMW"
          defaultValue={values.make}
        />
        <Field
          label={t("modelLabel")}
          name="model"
          error={errorFor("model")}
          required
          maxLength={LIMITS.model}
          placeholder="M3 E30"
          defaultValue={values.model}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          label={t("yearLabel")}
          name="year"
          error={errorFor("year")}
          inputMode="numeric"
          type="number"
          min={1885}
          max={maxYear}
          defaultValue={values.year}
        />
        <Field
          label={t("powerLabel")}
          name="power_hp"
          error={errorFor("power_hp")}
          inputMode="numeric"
          type="number"
          min={1}
          max={5000}
          defaultValue={values.power_hp}
          hint={t("powerHint")}
        />
        <Field
          label={t("acquiredLabel")}
          name="acquired_on"
          error={errorFor("acquired_on")}
          type="date"
          defaultValue={values.acquired_on}
        />
      </div>

      <Field
        label={t("engineLabel")}
        name="engine"
        maxLength={LIMITS.engine}
        placeholder={t("enginePlaceholder")}
        defaultValue={values.engine}
      />

      <SelectField label={t("countryLabel")} name="country" error={errorFor("country")} defaultValue={values.country}>
        <option value="">{tCommon("notSelected")}</option>
        {countries.priority.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
        <option disabled>──────────</option>
        {countries.other.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </SelectField>

      <TextareaField
        label={t("descriptionLabel")}
        name="description"
        rows={3}
        maxLength={LIMITS.description}
        defaultValue={values.description}
        hint={t("descriptionHint")}
      />
      <TextareaField
        label={t("storyLabel")}
        name="story"
        rows={6}
        maxLength={LIMITS.story}
        defaultValue={values.story}
        hint={t("storyHint")}
      />

      <ChoiceCards
        legend={t("visibilityLabel")}
        name="visibility"
        defaultValue={values.visibility}
        choices={[
          {
            value: "public",
            title: tCommon("visibilityPublic"),
            description: t("visibilityPublicText"),
          },
          {
            value: "private",
            title: tCommon("visibilityPrivate"),
            description: t("visibilityPrivateText"),
          },
        ]}
      />

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? tCommon("saving") : values.id ? tCommon("save") : t("createSubmit")}
      </Button>
    </form>
  );
}
