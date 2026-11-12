"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/textarea";
import { useKeepValuesSubmit } from "@/components/ui/use-keep-values-submit";
import { updateCrew, type CrewEditState } from "@/lib/crews/actions";

const initial: CrewEditState = { status: "idle" };

export function CrewEditForm({
  values,
}: {
  values: { id: string; focus: string; description: string; join_policy: "open" | "approval" };
}) {
  const t = useTranslations("Crews");
  const tCommon = useTranslations("Common");
  const [state, action, pending] = useActionState(updateCrew, initial);
  const submit = useKeepValuesSubmit(action);
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={values.id} />
      {state.status === "saved" ? <Alert tone="success">{t("saved")}</Alert> : null}
      {state.status === "error" ? <Alert tone="error">{t(`errors.${state.error}`)}</Alert> : null}
      <Field label={t("focusLabel")} name="focus" maxLength={80} defaultValue={values.focus} hint={t("focusHint")} />
      <TextareaField label={t("descriptionLabel")} name="description" rows={5} maxLength={2000} defaultValue={values.description} />
      <ChoiceCards
        legend={t("policyLabel")}
        name="join_policy"
        defaultValue={values.join_policy}
        choices={[
          { value: "approval", title: t("policyApproval"), description: t("policyApprovalText") },
          { value: "open", title: t("policyOpen"), description: t("policyOpenText") },
        ]}
      />
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? tCommon("saving") : tCommon("save")}
      </Button>
    </form>
  );
}
