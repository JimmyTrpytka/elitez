"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/textarea";
import { useKeepValuesSubmit } from "@/components/ui/use-keep-values-submit";
import { useScrollToError } from "@/components/ui/use-scroll-to-error";
import { submitFeedback, type FeedbackFormState } from "@/lib/feedback/actions";

const initial: FeedbackFormState = { status: "idle" };

export function FeedbackForm({ from, signedIn }: { from: string; signedIn: boolean }) {
  const t = useTranslations("Feedback");
  const [state, action, pending] = useActionState(submitFeedback, initial);
  const submit = useKeepValuesSubmit(action);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldOf: Record<string, string> = { invalid_message: "message", invalid_email: "email" };
  const errField = state.status === "error" ? fieldOf[state.error] : undefined;
  const errMessage = state.status === "error" ? t(`errors.${state.error}`) : undefined;
  useScrollToError(state, errField, formRef);

  if (state.status === "success") {
    return <Alert tone="success">{t("thanks")}</Alert>;
  }

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-5">
      <input type="hidden" name="from" value={from} />
      {state.status === "error" && !errField ? <Alert tone="error">{errMessage}</Alert> : null}
      {from ? (
        <p className="text-sm text-subtle">
          {t("fromPage")}: <span className="font-mono text-ink">{from}</span>
        </p>
      ) : null}
      <TextareaField
        label={t("messageLabel")}
        name="message"
        rows={7}
        required
        minLength={3}
        maxLength={4000}
        placeholder={t("messagePlaceholder")}
        error={errField === "message" ? errMessage : undefined}
      />
      {!signedIn ? (
        <Field
          label={t("emailLabel")}
          name="email"
          type="email"
          autoComplete="email"
          hint={t("emailHint")}
          error={errField === "email" ? errMessage : undefined}
        />
      ) : null}
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("sending") : t("send")}
        </Button>
      </div>
    </form>
  );
}
