"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { TextareaField } from "@/components/ui/textarea";
import { MapPicker } from "@/components/organizer/map-picker";
import { countryOptions } from "@/lib/countries";
import { saveEvent, type EventFormState } from "@/lib/organizer/actions";
import { Constants } from "@/lib/supabase/database.types";

export type EventFormValues = {
  id?: string;
  title: string;
  slug: string;
  season_id: string;
  starts_at: string;
  ends_at: string;
  venue_name: string;
  venue_address: string;
  lat: number | null;
  lng: number | null;
  country: string;
  category: string;
  capacity: string;
  description: string;
  program: string;
  rules: string;
  selection_criteria: string;
  access: string;
  verified_priority: boolean;
  verified_head_start_hours: number;
  registration_opens_at: string;
  registration_closes_at: string;
};

const initial: EventFormState = { status: "idle" };
const HEAD_START = [0, 24, 72, 168, 720] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-5 border-t border-line pt-6 first:border-t-0 first:pt-0">
      <legend className="mb-1 text-lg font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

export function EventForm({
  values,
  seasons,
}: {
  values: EventFormValues;
  seasons: Array<{ id: string; name: string; year: number }>;
}) {
  const t = useTranslations("EventForm");
  const tCommon = useTranslations("Common");
  const tCat = useTranslations("EventCategory");
  const tAccess = useTranslations("EventAccess");
  const locale = useLocale();
  const [state, action, pending] = useActionState(saveEvent, initial);
  const countries = countryOptions(locale);

  return (
    <form action={action} className="flex flex-col gap-8">
      <input type="hidden" name="locale" value={locale} />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {state.status === "error" ? (
        <Alert tone="error">{t(`errors.${state.error}`)}</Alert>
      ) : null}

      <Section title={t("basicsTitle")}>
        <Field label={t("titleLabel")} name="title" required maxLength={120} defaultValue={values.title} />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label={t("seasonLabel")} name="season_id" defaultValue={values.season_id}>
            <option value="">{t("noSeason")}</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <SelectField label={t("categoryLabel")} name="category" defaultValue={values.category}>
            {Constants.public.Enums.event_category.map((c) => (
              <option key={c} value={c}>
                {tCat(c)}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t("startsLabel")}
            name="starts_at"
            type="datetime-local"
            required
            defaultValue={values.starts_at}
          />
          <Field
            label={t("endsLabel")}
            name="ends_at"
            type="datetime-local"
            required
            defaultValue={values.ends_at}
          />
        </div>
        <p className="-mt-3 text-xs text-subtle">{t("timezoneHint")}</p>
        <TextareaField
          label={t("descriptionLabel")}
          name="description"
          rows={5}
          maxLength={5000}
          defaultValue={values.description}
        />
        <Field
          label={t("slugLabel")}
          name="slug"
          maxLength={80}
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={values.slug}
          hint={t("slugHint")}
        />
      </Section>

      <Section title={t("placeTitle")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("venueNameLabel")} name="venue_name" maxLength={120} defaultValue={values.venue_name} />
          <SelectField label={t("countryLabel")} name="country" defaultValue={values.country}>
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
        </div>
        <Field
          label={t("venueAddressLabel")}
          name="venue_address"
          maxLength={200}
          defaultValue={values.venue_address}
        />
        <MapPicker
          initial={values.lat !== null && values.lng !== null ? { lat: values.lat, lng: values.lng } : null}
        />
      </Section>

      <Section title={t("contentTitle")}>
        <TextareaField
          label={t("programLabel")}
          name="program"
          rows={6}
          maxLength={5000}
          defaultValue={values.program}
          hint={t("programHint")}
        />
        <TextareaField label={t("rulesLabel")} name="rules" rows={5} maxLength={5000} defaultValue={values.rules} />
        <TextareaField
          label={t("selectionLabel")}
          name="selection_criteria"
          rows={4}
          maxLength={5000}
          defaultValue={values.selection_criteria}
          hint={t("selectionHint")}
        />
      </Section>

      <Section title={t("registrationTitle")}>
        <p className="-mt-2 text-sm text-ink-soft">{t("registrationIntro")}</p>
        <ChoiceCards
          legend={t("accessLabel")}
          name="access"
          defaultValue={values.access}
          choices={Constants.public.Enums.event_access.map((a) => ({
            value: a,
            title: tAccess(a),
            description: t(`accessText.${a}`),
          }))}
        />
        <Field
          label={t("capacityLabel")}
          name="capacity"
          type="number"
          inputMode="numeric"
          min={1}
          defaultValue={values.capacity}
          hint={t("capacityHint")}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t("opensLabel")}
            name="registration_opens_at"
            type="datetime-local"
            defaultValue={values.registration_opens_at}
          />
          <Field
            label={t("closesLabel")}
            name="registration_closes_at"
            type="datetime-local"
            defaultValue={values.registration_closes_at}
          />
        </div>
        <SelectField
          label={t("headStartLabel")}
          name="verified_head_start_hours"
          defaultValue={String(values.verified_head_start_hours)}
          hint={t("headStartHint")}
        >
          {HEAD_START.map((h) => (
            <option key={h} value={h}>
              {t(`headStart.h${h}`)}
            </option>
          ))}
        </SelectField>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            name="verified_priority"
            defaultChecked={values.verified_priority}
            className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
          />
          <span>
            <span className="font-semibold">{t("priorityLabel")}</span>
            <span className="block text-ink-soft">{t("priorityHint")}</span>
          </span>
        </label>
      </Section>

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-surface/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? tCommon("saving") : values.id ? tCommon("save") : t("createSubmit")}
        </Button>
      </div>
    </form>
  );
}
