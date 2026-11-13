"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert } from "./alert";

/** Potvrzení „Uloženo“ po přesměrování z formuláře (adresa končí ?saved=1). */
export function SavedNotice() {
  const params = useSearchParams();
  const t = useTranslations("Common");
  if (params.get("saved") !== "1") return null;
  return (
    <div className="mb-6">
      <Alert tone="success">{t("savedNotice")}</Alert>
    </div>
  );
}
