"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { adminSetCrewStatus, type CrewError } from "@/lib/crews/actions";
import { Button } from "@/components/ui/button";

/** Admin: schválit / zamítnout s důvodem / pozastavit / obnovit crew. */
export function AdminCrewActions({ crewId, status }: { crewId: string; status: string }) {
  const t = useTranslations("AdminCrews");
  const tCrews = useTranslations("Crews");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<CrewError | null>(null);

  const set = (next: "approved" | "rejected" | "suspended", why?: string) => {
    setError(null);
    startTransition(async () => {
      const res = await adminSetCrewStatus(crewId, next, why);
      if (!res.ok) setError(res.error);
      else setRejecting(false);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "pending" ? (
          <>
            <Button disabled={pending} onClick={() => set("approved")}>
              {t("approve")}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setRejecting((v) => !v)}>
              {t("reject")}
            </Button>
          </>
        ) : null}
        {status === "approved" ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (window.confirm(t("suspendConfirm"))) set("suspended");
            }}
          >
            {t("suspend")}
          </Button>
        ) : null}
        {status === "suspended" ? (
          <Button variant="secondary" disabled={pending} onClick={() => set("approved")}>
            {t("restore")}
          </Button>
        ) : null}
      </div>
      {rejecting ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder={t("reasonPlaceholder")}
            className="h-11 flex-1 rounded-control border border-line px-4 text-ink"
          />
          <Button variant="secondary" disabled={pending} onClick={() => set("rejected", reason)}>
            {t("confirmReject")}
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-sm font-semibold text-danger">{tCrews(`errors.${error}`)}</p> : null}
    </div>
  );
}
