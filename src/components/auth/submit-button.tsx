"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Odesílací tlačítko formuláře – během odesílání se zablokuje. */
export function SubmitButton({
  label,
  pending,
}: {
  label: string;
  pending: boolean;
}) {
  const t = useTranslations("Auth");
  return (
    <Button
      type="submit"
      size="lg"
      className="w-full"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? t("submitting") : label}
    </Button>
  );
}
