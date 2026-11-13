"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { addCoOrganizer, removeCoOrganizer, type CoOrganizerResult } from "@/lib/organizer/profile-actions";
import { Avatar } from "@/components/avatar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type CoOrganizer = { userId: string; username: string; displayName: string | null; avatarUrl: string | null };

/** Spolupořadatelé: vlastník přidává a odebírá, spolupořadatel může odejít. */
export function CoOrganizers({
  members,
  canManage,
  currentUserId,
}: {
  members: CoOrganizer[];
  canManage: boolean;
  currentUserId: string;
}) {
  const t = useTranslations("OrganizerProfile");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const run = (fn: () => Promise<CoOrganizerResult>, success?: string) => {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        if (success) setMessage({ tone: "success", text: success });
        setUsername("");
      } else setMessage({ tone: "error", text: t(`coErrors.${res.error}`) });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">{t("coIntro")}</p>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {members.length ? (
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3 p-3">
              <span className="flex items-center gap-3">
                <Avatar url={m.avatarUrl} name={m.displayName ?? m.username} size={40} />
                <span>
                  <span className="block font-semibold text-ink">{m.displayName ?? m.username}</span>
                  <span className="text-sm text-subtle">@{m.username}</span>
                </span>
              </span>
              {canManage || m.userId === currentUserId ? (
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(m.userId === currentUserId ? t("coLeaveConfirm") : t("coRemoveConfirm"))) {
                      run(() => removeCoOrganizer(m.userId));
                    }
                  }}
                >
                  {m.userId === currentUserId ? t("coLeave") : t("coRemove")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-subtle">{t("coEmpty")}</p>
      )}
      {canManage ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addCoOrganizer(username), t("coAdded", { username: username.replace(/^@/, "") }));
          }}
        >
          <label htmlFor="co-username" className="sr-only">
            {t("coUsernameLabel")}
          </label>
          <input
            id="co-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("coUsernamePlaceholder")}
            className="h-12 flex-1 rounded-control border border-line px-4 text-base text-ink focus:border-ink focus:outline-none"
          />
          <Button type="submit" disabled={pending || username.trim().length < 3}>
            {t("coAdd")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
