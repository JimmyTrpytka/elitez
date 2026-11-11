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
import { updateProfile, type ProfileFormState } from "@/lib/profile/actions";
import { LIMITS } from "@/lib/validation";

export type ProfileFormValues = {
  username: string;
  display_name: string;
  country: string;
  city: string;
  bio: string;
  visibility: "public" | "private";
};

const initial: ProfileFormState = { status: "idle" };

export function ProfileForm({ values }: { values: ProfileFormValues }) {
  const t = useTranslations("Profile");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [state, action, pending] = useActionState(updateProfile, initial);
  const submit = useKeepValuesSubmit(action);
  const formRef = useRef<HTMLFormElement>(null);
  // Chyba u konkrétního pole: ukáže se pod ním a stránka se k němu posune
  const fieldOf: Record<string, string> = { usernameInvalid: "username", usernameTaken: "username", displayNameTooLong: "display_name", cityTooLong: "city", bioTooLong: "bio", countryInvalid: "country" };
  const errField = state.status === "error" ? fieldOf[state.error] : undefined;
  const errMessage = state.status === "error" ? t(`errors.${state.error}`) : undefined;
  const errorFor = (name: string) => (errField === name ? errMessage : undefined);
  useScrollToError(state, errField, formRef);
  const countries = countryOptions(locale);

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-5">
      {state.status === "error" && !errField ? (
        <Alert tone="error">{t(`errors.${state.error}`)}</Alert>
      ) : null}
      {state.status === "success" ? (
        <Alert tone="success">{t("saved")}</Alert>
      ) : null}

      <Field
        label={t("usernameLabel")}
        name="username"
        error={errorFor("username")}
        required
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={30}
        defaultValue={values.username}
        hint={t("usernameHint")}
      />
      <Field
        label={t("displayNameLabel")}
        name="display_name"
        error={errorFor("display_name")}
        autoComplete="name"
        maxLength={LIMITS.displayName}
        defaultValue={values.display_name}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label={t("countryLabel")}
          name="country"
          error={errorFor("country")}
          defaultValue={values.country}
        >
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
        <Field
          label={t("cityLabel")}
          name="city"
          error={errorFor("city")}
          autoComplete="address-level2"
          maxLength={LIMITS.city}
          defaultValue={values.city}
        />
      </div>
      <TextareaField
        label={t("bioLabel")}
        name="bio"
        error={errorFor("bio")}
        maxLength={LIMITS.bio}
        defaultValue={values.bio}
        hint={t("bioHint", { max: LIMITS.bio })}
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
        {pending ? tCommon("saving") : tCommon("save")}
      </Button>
    </form>
  );
}
