"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { untagMyVehicle } from "@/lib/gallery/actions";

/** Majitel auta odebere označení svého auta z fotky creatora. */
export function UntagButton({ itemId }: { itemId: string }) {
  const t = useTranslations("Gallery");
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="font-semibold text-white underline underline-offset-4">
        {t("untag")}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-3">
      {failed ? <span className="text-accent">{t("errors.generic")}</span> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await untagMyVehicle(itemId);
            if (res.ok) router.refresh();
            else setFailed(true);
          })
        }
        className="h-9 rounded-full bg-danger px-4 font-semibold text-white disabled:opacity-50"
      >
        {t("untagYes")}
      </button>
    </span>
  );
}
