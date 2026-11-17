"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateMyRegistration } from "@/lib/registrations/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const input =
  "h-11 w-full rounded-control border border-line bg-surface px-3 text-base text-ink focus:border-ink focus:outline-none";

/** Úprava čekající přihlášky: telefon, e-mail, zpráva pořadateli. */
export function EditRegistration({
  registrationId,
  phone,
  email,
  message,
}: {
  registrationId: string;
  phone: string;
  email: string;
  message: string | null;
}) {
  const t = useTranslations("MyRegistrations");
  const tReg = useTranslations("Registration");
  const tErrors = useTranslations("RegistrationErrors");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ phone, email, message: message ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setSaved(false);
          }}
          className="text-sm font-semibold text-ink underline underline-offset-4"
        >
          {t("edit")}
        </button>
        {saved ? <span className="text-sm text-success">{t("editSaved")}</span> : null}
      </div>
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateMyRegistration({ registrationId, ...values });
      if (!result.ok) {
        setError(tErrors(result.error));
        return;
      }
      setOpen(false);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-control border border-line p-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          {tReg("phoneLabel")}
          <input
            type="tel"
            autoComplete="tel"
            value={values.phone}
            maxLength={30}
            onChange={(e) => setValues({ ...values, phone: e.target.value })}
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          {tReg("emailLabel")}
          <input
            type="email"
            autoComplete="email"
            value={values.email}
            maxLength={254}
            onChange={(e) => setValues({ ...values, email: e.target.value })}
            className={input}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        {tReg("messageLabel")}
        <textarea
          value={values.message}
          rows={3}
          maxLength={1000}
          onChange={(e) => setValues({ ...values, message: e.target.value })}
          className="rounded-control border border-line bg-surface px-3 py-2 text-base font-normal text-ink focus:border-ink focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={pending} onClick={save}>
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          {tCommon("cancel")}
        </Button>
      </div>
    </div>
  );
}
