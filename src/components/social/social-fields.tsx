"use client";

import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/field";
import { SOCIAL_KINDS, type SocialKind } from "@/lib/url";

/** Pole pro odkazy na sociální sítě (stačí i „@jméno“). */
export function SocialFields({
  values,
  errorField,
  errorMessage,
}: {
  values: Partial<Record<`${SocialKind}_url`, string | null>>;
  errorField?: string;
  errorMessage?: string;
}) {
  const t = useTranslations("SocialLinks");
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-sm font-medium text-ink">{t("legend")}</legend>
      <p className="-mt-2 text-sm text-subtle">{t("hint")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {SOCIAL_KINDS.map((kind) => {
          const name = `${kind}_url`;
          return (
            <Field
              key={kind}
              label={t(`labels.${kind}`)}
              name={name}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={200}
              placeholder={t(`placeholders.${kind}`)}
              defaultValue={values[name as `${SocialKind}_url`] ?? ""}
              error={errorField === name ? errorMessage : undefined}
            />
          );
        })}
      </div>
    </fieldset>
  );
}
