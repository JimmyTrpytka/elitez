"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useKeepValuesSubmit } from "@/components/ui/use-keep-values-submit";
import { useScrollToError } from "@/components/ui/use-scroll-to-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/textarea";
import { createCrew, findSimilarCrews, type CrewFormState } from "@/lib/crews/actions";

const initial: CrewFormState = { status: "idle" };

export function CrewCreateForm() {
  const t = useTranslations("Crews");
  const locale = useLocale();
  const [state, action, pending] = useActionState(createCrew, initial);
  const submit = useKeepValuesSubmit(action);
  const formRef = useRef<HTMLFormElement>(null);
  const errField = state.status === "error" ? state.field : undefined;
  const errMessage = state.status === "error" ? t(`errors.${state.error}`) : undefined;
  useScrollToError(state, errField, formRef);

  // Podobné crew při psaní názvu (s malým zpožděním)
  const [name, setName] = useState("");
  const [similar, setSimilar] = useState<Array<{ slug: string; name: string; status: string }>>([]);
  useEffect(() => {
    const id = setTimeout(() => {
      if (name.trim().length < 3) {
        setSimilar([]);
        return;
      }
      void findSimilarCrews(name).then(setSimilar);
    }, 400);
    return () => clearTimeout(id);
  }, [name]);

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      {state.status === "error" && !errField ? <Alert tone="error">{errMessage}</Alert> : null}

      <div className="flex flex-col gap-2">
        <Field
          label={t("nameLabel")}
          name="name"
          required
          minLength={3}
          maxLength={60}
          placeholder="Audi RS6 Fans Praha"
          hint={t("nameHint")}
          error={errField === "name" ? errMessage : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        {similar.length ? (
          <div className="rounded-control border border-line bg-muted p-4 text-sm">
            <p className="font-semibold text-ink">{t("similarTitle")}</p>
            <ul className="mt-2 flex flex-col gap-1">
              {similar.map((c) => (
                <li key={c.slug}>
                  {c.status === "approved" ? (
                    <Link href={`/c/${c.slug}`} className="font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4">
                      {c.name}
                    </Link>
                  ) : (
                    <span className="text-ink-soft">
                      {c.name} ({t("similarPending")})
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-ink-soft">{t("similarHint")}</p>
          </div>
        ) : null}
      </div>

      <Field label={t("focusLabel")} name="focus" maxLength={80} placeholder="Audi RS · Praha" hint={t("focusHint")} />
      <TextareaField label={t("descriptionLabel")} name="description" rows={4} maxLength={2000} hint={t("descriptionHint")} />
      <ChoiceCards
        legend={t("policyLabel")}
        name="join_policy"
        defaultValue="approval"
        choices={[
          { value: "approval", title: t("policyApproval"), description: t("policyApprovalText") },
          { value: "open", title: t("policyOpen"), description: t("policyOpenText") },
        ]}
      />
      <p className="text-sm text-ink-soft">{t("reviewNote")}</p>
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? t("creating") : t("createSubmit")}
      </Button>
    </form>
  );
}
