"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useKeepValuesSubmit } from "@/components/ui/use-keep-values-submit";
import { useScrollToError } from "@/components/ui/use-scroll-to-error";
import { Alert } from "@/components/ui/alert";
import { StickyActions } from "@/components/ui/sticky-actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/textarea";
import { saveOrganizerProfile, type OrganizerProfileState } from "@/lib/organizer/profile-actions";

export type OrganizerProfileValues = {
  name: string;
  description: string;
  slug: string;
  website_url: string;
  instagram_url: string;
  facebook_url: string;
  show_past_events: boolean;
};

const initial: OrganizerProfileState = { status: "idle" };

export function OrganizerProfileForm({ values, siteUrl }: { values: OrganizerProfileValues; siteUrl: string }) {
  const t = useTranslations("OrganizerProfile");
  const tCommon = useTranslations("Common");
  const [state, action, pending] = useActionState(saveOrganizerProfile, initial);
  const submit = useKeepValuesSubmit(action);
  const formRef = useRef<HTMLFormElement>(null);
  const errField = state.status === "error" ? state.field : undefined;
  const errMessage = state.status === "error" ? t(`errors.${state.error}`) : undefined;
  const errorFor = (name: string) => (errField === name ? errMessage : undefined);
  useScrollToError(state, errField, formRef);

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-5">
      {state.status === "saved" ? <Alert tone="success">{t("saved")}</Alert> : null}
      {state.status === "error" && !errField ? <Alert tone="error">{errMessage}</Alert> : null}

      <Field label={t("nameLabel")} name="name" required maxLength={80} defaultValue={values.name} error={errorFor("name")} />
      <Field
        label={t("slugLabel")}
        name="slug"
        required
        maxLength={60}
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        defaultValue={values.slug}
        error={errorFor("slug")}
        hint={t("slugHint", { url: `${siteUrl}/o/…` })}
      />
      <TextareaField
        label={t("descriptionLabel")}
        name="description"
        rows={5}
        maxLength={2000}
        defaultValue={values.description}
        hint={t("descriptionHint")}
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-medium text-ink">{t("linksLabel")}</legend>
        <Field label={t("websiteLabel")} name="website_url" inputMode="url" placeholder="www.example.cz" defaultValue={values.website_url} error={errorFor("website_url")} />
        <Field label="Instagram" name="instagram_url" inputMode="url" placeholder="instagram.com/…" defaultValue={values.instagram_url} error={errorFor("instagram_url")} />
        <Field label="Facebook" name="facebook_url" inputMode="url" placeholder="facebook.com/…" defaultValue={values.facebook_url} error={errorFor("facebook_url")} />
      </fieldset>

      <label className="flex cursor-pointer items-start gap-3 rounded-control border border-line p-4 has-[:checked]:border-ink has-[:checked]:bg-muted">
        <input type="checkbox" name="show_past_events" defaultChecked={values.show_past_events} className="mt-0.5 h-5 w-5 accent-ink" />
        <span>
          <span className="block font-semibold text-ink">{t("showPastLabel")}</span>
          <span className="text-sm text-ink-soft">{t("showPastHint")}</span>
        </span>
      </label>

      <StickyActions note={state.status === "saved" && !pending ? `${t("saved")} ✓` : undefined}>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
      </StickyActions>
    </form>
  );
}
