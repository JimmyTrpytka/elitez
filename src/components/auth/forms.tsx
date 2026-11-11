"use client";

import { useKeepValuesSubmit } from "@/components/ui/use-keep-values-submit";
import { useActionState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  type AuthErrorKey,
  type AuthFormState,
} from "@/lib/auth/actions";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { FieldMessage } from "@/components/ui/field-message";
import { buttonClasses } from "@/components/ui/button";
import { useScrollToError } from "@/components/ui/use-scroll-to-error";
import { SubmitButton } from "./submit-button";
import { textLinkClass } from "./auth-shell";

const initialState: AuthFormState = { status: "idle" };

/** Ke kterému poli chyba patří (ostatní se ukážou v rámečku). */
const FIELD_OF: Partial<Record<AuthErrorKey, string>> = {
  invalidEmail: "email",
  passwordTooShort: "password",
  weakPassword: "password",
  samePassword: "password",
  ageRequired: "age",
};

/** Společné zpracování chyby: pole, text a posun k ní. */
function useFormError(state: AuthFormState, formRef: React.RefObject<HTMLFormElement | null>) {
  const t = useTranslations("Errors");
  const field = state.status === "error" ? FIELD_OF[state.error] : undefined;
  const message = state.status === "error" ? t(state.error) : undefined;
  useScrollToError(state, field, formRef);
  return {
    errorFor: (name: string) => (field === name ? message : undefined),
    generalError: state.status === "error" && !field ? message : undefined,
  };
}

function lastEmail(state: AuthFormState): string | undefined {
  return state.status === "error" ? state.email : undefined;
}

export function LoginForm({ linkError, next }: { linkError: boolean; next?: string }) {
  const t = useTranslations("Auth");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(signIn, initialState);
  const submit = useKeepValuesSubmit(action);
  const { errorFor, generalError } = useFormError(state, formRef);

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {linkError && state.status === "idle" ? (
        <Alert tone="error">{tErrors("linkInvalid")}</Alert>
      ) : null}
      {generalError ? <Alert tone="error">{generalError}</Alert> : null}
      <Field
        label={t("emailLabel")}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={lastEmail(state)}
        key={`email-${lastEmail(state) ?? ""}`}
        error={errorFor("email")}
      />
      <Field
        label={t("passwordLabel")}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={errorFor("password")}
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
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(signUp, initialState);
  const submit = useKeepValuesSubmit(action);
  const { errorFor, generalError } = useFormError(state, formRef);

  if (state.status === "success") {
    return <Alert tone="success">{t("registerCheckEmail")}</Alert>;
  }

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {generalError ? <Alert tone="error">{generalError}</Alert> : null}
      <Field
        label={t("emailLabel")}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={lastEmail(state)}
        key={`email-${lastEmail(state) ?? ""}`}
        error={errorFor("email")}
      />
      <Field
        label={t("passwordLabel")}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint={t("passwordHint")}
        error={errorFor("password")}
      />
      <div className="flex flex-col gap-1.5" data-field="age">
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            name="age"
            required
            aria-invalid={errorFor("age") ? true : undefined}
            aria-describedby={errorFor("age") ? "age-message" : undefined}
            className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
          />
          <span>{t("ageLabel")}</span>
        </label>
        <FieldMessage id="age-message" error={errorFor("age")} />
      </div>
      <p className="text-xs text-subtle">
        {t("privacyNote")}{" "}
        <Link href="/privacy" className={textLinkClass}>
          {t("privacyLink")}
        </Link>
        .
      </p>
      <SubmitButton label={t("registerSubmit")} pending={pending} />
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);
  const submit = useKeepValuesSubmit(action);
  const { errorFor, generalError } = useFormError(state, formRef);

  if (state.status === "success") {
    return <Alert tone="success">{t("forgotSent")}</Alert>;
  }

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {generalError ? <Alert tone="error">{generalError}</Alert> : null}
      <Field
        label={t("emailLabel")}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={lastEmail(state)}
        key={`email-${lastEmail(state) ?? ""}`}
        error={errorFor("email")}
      />
      <SubmitButton label={t("forgotSubmit")} pending={pending} />
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(updatePassword, initialState);
  const submit = useKeepValuesSubmit(action);
  const { errorFor, generalError } = useFormError(state, formRef);

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
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {generalError ? <Alert tone="error">{generalError}</Alert> : null}
      <Field
        label={t("newPasswordLabel")}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint={t("passwordHint")}
        error={errorFor("password")}
      />
      <SubmitButton label={t("resetSubmit")} pending={pending} />
    </form>
  );
}
