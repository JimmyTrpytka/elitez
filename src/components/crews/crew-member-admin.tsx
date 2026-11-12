"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { decideCrewMember } from "@/lib/crews/actions";
import { Button } from "@/components/ui/button";

/** Tlačítka správce u člena / žádosti: Přijmout, Zamítnout, Odebrat. */
export function CrewMemberAdmin({
  crewId,
  userId,
  status,
}: {
  crewId: string;
  userId: string;
  status: "pending" | "active";
}) {
  const t = useTranslations("Crews");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const act = (action: "approve" | "reject" | "remove") => {
    if (action === "remove" && !window.confirm(t("removeConfirm"))) return;
    setFailed(false);
    startTransition(async () => {
      const res = await decideCrewMember(crewId, userId, action);
      if (!res.ok) setFailed(true);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "pending" ? (
        <>
          <Button size="md" disabled={pending} onClick={() => act("approve")}>
            {t("approve")}
          </Button>
          <Button size="md" variant="outlineDark" disabled={pending} onClick={() => act("reject")}>
            {t("reject")}
          </Button>
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => act("remove")}
          className="text-xs font-semibold text-white/50 underline hover:text-white"
        >
          {t("remove")}
        </button>
      )}
      {failed ? <span className="text-xs text-accent">{t("errors.generic")}</span> : null}
    </div>
  );
}
