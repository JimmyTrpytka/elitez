"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { decideRegistration } from "@/lib/registrations/actions";

/** Rychlé schválení přímo v seznamu přihlášek (známá / jasná auta). */
export function QuickApprove({ registrationId }: { registrationId: string }) {
  const t = useTranslations("Decision");
  const tErrors = useTranslations("RegistrationErrors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await decideRegistration({ registrationId, decision: "approved" });
            setError(result.ok ? null : tErrors(result.error));
            router.refresh();
          })
        }
        className="h-9 rounded-full bg-accent px-4 text-sm font-semibold text-ink transition-colors hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? "…" : t("approve")}
      </button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
