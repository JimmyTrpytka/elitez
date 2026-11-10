"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

/**
 * Serverové akce pro přihlášení. Vracejí jen KLÍČ chyby/úspěchu,
 * text v daném jazyce doplní formulář z překladů (src/i18n/messages).
 */
export type AuthErrorKey =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "invalidEmail"
  | "passwordTooShort"
  | "weakPassword"
  | "samePassword"
  | "ageRequired"
  | "rateLimited"
  | "notSignedIn"
  | "notConfigured"
  | "generic";

export type AuthFormState =
  | { status: "idle" }
  | { status: "error"; error: AuthErrorKey; email?: string }
  | { status: "success" };

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readLocale(formData: FormData): Locale {
  const value = readString(formData, "locale");
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

/** Adresa webu (pro odkazy v e-mailech). */
async function getOrigin(): Promise<string> {
  const h = await headers();
  return (
    h.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  );
}

function mapAuthError(error: AuthError): AuthErrorKey {
  switch (error.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "weak_password":
      return "weakPassword";
    case "same_password":
      return "samePassword";
    case "email_address_invalid":
      return "invalidEmail";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rateLimited";
    default:
      return error.status === 429 ? "rateLimited" : "generic";
  }
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = readLocale(formData);
  const email = readString(formData, "email");
  const password = formData.get("password");

  if (!EMAIL_PATTERN.test(email)) {
    return { status: "error", error: "invalidEmail", email };
  }
  if (typeof password !== "string" || password.length === 0) {
    return { status: "error", error: "invalidCredentials", email };
  }

  const supabase = await createClient();
  if (!supabase) return { status: "error", error: "notConfigured", email };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { status: "error", error: mapAuthError(error), email };

  redirect(`/${locale}/account`);
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = readLocale(formData);
  const email = readString(formData, "email");
  const password = formData.get("password");

  if (!EMAIL_PATTERN.test(email)) {
    return { status: "error", error: "invalidEmail", email };
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return { status: "error", error: "passwordTooShort", email };
  }
  if (formData.get("age") !== "on") {
    return { status: "error", error: "ageRequired", email };
  }

  const supabase = await createClient();
  if (!supabase) return { status: "error", error: "notConfigured", email };

  const origin = await getOrigin();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/${locale}/account`,
      data: { locale, age_confirmed_at: new Date().toISOString() },
    },
  });
  if (error) return { status: "error", error: mapAuthError(error), email };

  // Úmyslně stejná zpráva i pro už existující e-mail (neprozrazujeme, kdo má účet).
  return { status: "success" };
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = readLocale(formData);
  const email = readString(formData, "email");

  if (!EMAIL_PATTERN.test(email)) {
    return { status: "error", error: "invalidEmail", email };
  }

  const supabase = await createClient();
  if (!supabase) return { status: "error", error: "notConfigured", email };

  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/${locale}/reset-password`,
  });
  // Při chybě „e-mail neexistuje“ apod. stejně hlásíme úspěch (soukromí).
  if (error && mapAuthError(error) === "rateLimited") {
    return { status: "error", error: "rateLimited", email };
  }
  return { status: "success" };
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return { status: "error", error: "passwordTooShort" };
  }

  const supabase = await createClient();
  if (!supabase) return { status: "error", error: "notConfigured" };

  const { data } = await supabase.auth.getUser();
  if (!data.user) return { status: "error", error: "notSignedIn" };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { status: "error", error: mapAuthError(error) };
  return { status: "success" };
}

export async function signOut(formData: FormData): Promise<void> {
  const locale = readLocale(formData);
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect(`/${locale}`);
}
