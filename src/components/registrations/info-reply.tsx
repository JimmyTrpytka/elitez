"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { replyRegistrationInfo } from "@/lib/registrations/actions";
import { Button } from "@/components/ui/button";

/** Žádost pořadatele o doplnění + odpověď uchazeče (Moje registrace). */
export function InfoReply({
  registrationId,
  request,
  reply,
  canReply,
}: {
  registrationId: string;
  request: string;
  reply: string | null;
  canReply: boolean;
}) {
  const t = useTranslations("InfoRequest");
  const tErrors = useTranslations("RegistrationErrors");
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!reply);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    startTransition(async () => {
      const result = await replyRegistrationInfo(registrationId, text);
      if (!result.ok) {
        setError(tErrors(result.error));
        return;
      }
      setText("");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-control border-2 border-ink p-4">
      <div>
        <p className="text-sm font-semibold text-ink">{t("memberTitle")}</p>
        <p className="mt-1 whitespace-pre-line text-ink">{request}</p>
      </div>
      <p className="text-sm text-ink-soft">{t("memberHint")}</p>
      {reply && !editing ? (
        <div className="rounded-control bg-muted px-3 py-2 text-sm">
          <p className="font-semibold text-ink">{t("yourReply")}</p>
          <p className="mt-1 whitespace-pre-line text-ink-soft">{reply}</p>
          {canReply ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-2 font-semibold text-ink underline underline-offset-4"
            >
              {t("replyAgain")}
            </button>
          ) : null}
        </div>
      ) : canReply ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={t("replyPlaceholder")}
            className="rounded-control border border-line bg-surface px-3 py-2 text-base text-ink focus:border-ink focus:outline-none"
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div>
            <Button variant="primary" disabled={pending || !text.trim()} onClick={send}>
              {pending ? t("sending") : t("sendReply")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
