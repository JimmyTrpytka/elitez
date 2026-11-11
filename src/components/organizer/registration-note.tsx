"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { saveRegistrationNote } from "@/lib/registrations/actions";

/** Interní poznámka pořadatele (uchazeč ji nevidí). */
export function RegistrationNote({
  registrationId,
  initial,
}: {
  registrationId: string;
  initial: string;
}) {
  const t = useTranslations("Decision");
  const tCommon = useTranslations("Common");
  const [note, setNote] = useState(initial);
  const [saved, setSaved] = useState<null | boolean>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="registration-note" className="sr-only">
        {t("noteTitle")}
      </label>
      <textarea
        id="registration-note"
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(null);
        }}
        rows={4}
        maxLength={2000}
        placeholder={t("notePlaceholder")}
        className="rounded-control border border-line px-4 py-3 text-base focus:border-ink focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          disabled={pending || note === initial}
          onClick={() =>
            startTransition(async () => {
              const result = await saveRegistrationNote(registrationId, note);
              setSaved(result.ok);
            })
          }
        >
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
        {saved === true ? <span className="text-sm text-success">{t("noteSaved")}</span> : null}
        {saved === false ? <span className="text-sm text-danger">{t("noteFailed")}</span> : null}
      </div>
    </div>
  );
}
