"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { requestRegistrationInfo } from "@/lib/registrations/actions";
import { Button } from "@/components/ui/button";

/** Pořadatel: „Doplň prosím“ – žádost o víc fotek / informací a odpověď uchazeče. */
export function RequestInfo({
  registrationId,
  request,
  requestedAt,
  reply,
  repliedAt,
  canRequest,
}: {
  registrationId: string;
  request: string | null;
  requestedAt: string | null;
  reply: string | null;
  repliedAt: string | null;
  canRequest: boolean;
}) {
  const t = useTranslations("InfoRequest");
  const tErrors = useTranslations("RegistrationErrors");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const presets = [t("presetPhotos"), t("presetMods"), t("presetInterior")];

  function send() {
    setError(null);
    startTransition(async () => {
      const result = await requestRegistrationInfo(registrationId, text);
      if (!result.ok) {
        setError(tErrors(result.error));
        return;
      }
      setOpen(false);
      setText("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {requestedAt && request ? (
        <div className="rounded-control bg-muted px-4 py-3 text-sm">
          <p className="font-semibold text-ink">{t("organizerAsked")}</p>
          <p className="mt-1 whitespace-pre-line text-ink-soft">{request}</p>
          {repliedAt ? (
            <div className="mt-3 border-t border-line pt-3">
              <p className="font-semibold text-success">{t("applicantReplied")}</p>
              <p className="mt-1 whitespace-pre-line text-ink">{reply}</p>
            </div>
          ) : (
            <p className="mt-2 text-subtle">{t("waitingForReply")}</p>
          )}
        </div>
      ) : null}
      {canRequest ? (
        open ? (
          <div className="flex flex-col gap-2 rounded-control border border-line p-4">
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setText((cur) => (cur ? `${cur}\n${p}` : p))}
                  className="rounded-full bg-muted px-3 py-1 text-sm text-ink hover:bg-line"
                >
                  + {p}
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={t("requestPlaceholder")}
              className="rounded-control border border-line bg-surface px-3 py-2 text-base text-ink focus:border-ink focus:outline-none"
            />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={pending || !text.trim()} onClick={send}>
                {pending ? t("sending") : t("sendRequest")}
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
                {tCommon("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button variant="ghost" onClick={() => setOpen(true)}>
              {requestedAt ? t("requestAgain") : t("request")}
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}
