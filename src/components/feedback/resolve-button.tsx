"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setFeedbackResolved } from "@/lib/feedback/actions";

export function ResolveFeedbackButton({ id, resolved }: { id: string; resolved: boolean }) {
  const t = useTranslations("FeedbackAdmin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setFeedbackResolved(id, !resolved);
          router.refresh();
        })
      }
      className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-ink hover:bg-line disabled:opacity-50"
    >
      {resolved ? t("reopen") : t("markResolved")}
    </button>
  );
}
