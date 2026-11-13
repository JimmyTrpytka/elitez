"use client";

import { useKeepValuesSubmit } from "@/components/ui/use-keep-values-submit";
import { useActionState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { useScrollToError } from "@/components/ui/use-scroll-to-error";
import { StickyActions } from "@/components/ui/sticky-actions";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { DateTimeField } from "@/components/ui/date-time-field";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { TextareaField } from "@/components/ui/textarea";
import { MapPicker } from "@/components/organizer/map-picker";
import { SocialFields } from "@/components/social/social-fields";
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
  social: Partial<Record<"website_url" | "instagram_url" | "facebook_url" | "tiktok_url" | "youtube_url", string | null>>;
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
  allowCrewOnly = false,
}: {
  values: EventFormValues;
  seasons: Array<{ id: string; name: string; year: number }>;
  /** Pořadatel je crew → může dělat srazy jen pro členy */
  allowCrewOnly?: boolean;
}) {
  const t = useTranslations("EventForm");
  const tCommon = useTranslations("Common");
  const tCat = useTranslations("EventCategory");
  const tAccess = useTranslations("EventAccess");
  const locale = useLocale();
  const [state, action, pending] = useActionState(saveEvent, initial);
  const submit = useKeepValuesSubmit(action);
  const formRef = useRef<HTMLFormElement>(null);
  // Chyba u konkrétního pole: ukáže se pod ním a stránka se k němu posune
  const fieldOf: Record<string, string> = { titleRequired: "title", startInvalid: "starts_at", endBeforeStart: "ends_at", registrationOrder: "registration_closes_at", registrationAfterStart: "registration_closes_at", slugInvalid: "slug", slugTaken: "slug", capacityInvalid: "capacity", countryInvalid: "country" };
  const errField = state.status === "error" ? (state.field ?? fieldOf[state.error]) : undefined;
  const errMessage = state.status === "error" ? t(`errors.${state.error}`) : undefined;
  const errorFor = (name: string) => (errField === name ? errMessage : undefined);
  useScrollToError(state, errField, formRef);
  const countries = countryOptions(locale);

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-8">
      <input type="hidden" name="locale" value={locale} />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {state.status === "error" && !errField ? (
        <Alert tone="error">{t(`errors.${state.error}`)}</Alert>
      ) : null}

      <Section title={t("basicsTitle")}>
        <Field label={t("titleLabel")} name="title" error={errorFor("title")} required maxLength={120} defaultValue={values.title} />
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
          <DateTimeField
            label={t("startsLabel")}
            name="starts_at"
            error={errorFor("starts_at")}
            required
            defaultValue={values.starts_at}
            defaultTime="10:00"
          />
          <DateTimeField
            label={t("endsLabel")}
            name="ends_at"
            error={errorFor("ends_at")}
            required
            defaultValue={values.ends_at}
            defaultTime="18:00"
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
          error={errorFor("slug")}
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
        <SocialFields values={values.social} errorField={errField} errorMessage={errMessage} />
      </Section>

      <Section title={t("registrationTitle")}>
        <p className="-mt-2 text-sm text-ink-soft">{t("registrationIntro")}</p>
        <ChoiceCards
          legend={t("accessLabel")}
          name="access"
          defaultValue={values.access}
          choices={Constants.public.Enums.event_access
            .filter((a) => a !== "crew_only" || allowCrewOnly)
            .map((a) => ({
            value: a,
            title: tAccess(a),
            description: t(`accessText.${a}`),
          }))}
        />
        <Field
          label={t("capacityLabel")}
          name="capacity"
          error={errorFor("capacity")}
          type="number"
          inputMode="numeric"
          min={1}
          defaultValue={values.capacity}
          hint={t("capacityHint")}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <DateTimeField
            label={t("opensLabel")}
            name="registration_opens_at"
            defaultValue={values.registration_opens_at}
            defaultTime="10:00"
            hint={t("opensHint")}
          />
          <DateTimeField
            label={t("closesLabel")}
            name="registration_closes_at"
            error={errorFor("registration_closes_at")}
            defaultValue={values.registration_closes_at}
            defaultTime="23:59"
            hint={t("closesHint")}
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

      <StickyActions>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? tCommon("saving") : values.id ? tCommon("save") : t("createSubmit")}
        </Button>
      </StickyActions>
    </form>
  );
}
