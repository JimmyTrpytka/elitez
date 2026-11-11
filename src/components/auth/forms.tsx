"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  type AuthFormState,
} from "@/lib/auth/actions";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { SubmitButton } from "./submit-button";
import { textLinkClass } from "./auth-shell";

const initialState: AuthFormState = { status: "idle" };

function ErrorMessage({ state }: { state: AuthFormState }) {
  const t = useTranslations("Errors");
  if (state.status !== "error") return null;
  return <Alert tone="error">{t(state.error)}</Alert>;
}

function lastEmail(state: AuthFormState): string | undefined {
  return state.status === "error" ? state.email : undefined;
}

export function LoginForm({ linkError, next }: { linkError: boolean; next?: string }) {
  const t = useTranslations("Auth");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {linkError && state.status === "idle" ? (
        <Alert tone="error">{tErrors("linkInvalid")}</Alert>
      ) : null}
      <ErrorMessage state={state} />
      <Field
        label={t("emailLabel")}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={lastEmail(state)}
        key={`email-${lastEmail(state) ?? ""}`}
      />
      <Field
        label={t("passwordLabel")}
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <div className="-mt-1 text-right text-sm">
        <Link href="/forgot-password" className={textLinkClass}>
          {t("forgotLink")}
        </Link>
      </div>
      <SubmitButton label={t("loginSubmit")} pending={pending} />
    </form>
  );
}

export function RegisterForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState(signUp, initialState);

  if (state.status === "success") {
    return <Alert tone="success">{t("registerCheckEmail")}</Alert>;
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <ErrorMessage state={state} />
      <Field
        label={t("emailLabel")}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={lastEmail(state)}
        key={`email-${lastEmail(state) ?? ""}`}
      />
      <Field
        label={t("passwordLabel")}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint={t("passwordHint")}
      />
      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          name="age"
          required
          className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
        />
        <span>{t("ageLabel")}</span>
      </label>
      <SubmitButton label={t("registerSubmit")} pending={pending} />
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  if (state.status === "success") {
    return <Alert tone="success">{t("forgotSent")}</Alert>;
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <ErrorMessage state={state} />
      <Field
        label={t("emailLabel")}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={lastEmail(state)}
        key={`email-${lastEmail(state) ?? ""}`}
      />
      <SubmitButton label={t("forgotSubmit")} pending={pending} />
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(updatePassword, initialState);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">{t("resetDone")}</Alert>
        <Link href="/account" className={buttonClasses("secondary", "lg")}>
          {t("accountTitle")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <ErrorMessage state={state} />
      <Field
        label={t("newPasswordLabel")}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint={t("passwordHint")}
      />
      <SubmitButton label={t("resetSubmit")} pending={pending} />
    </form>
  );
}
