"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/textarea";
import { cancelMediaRequest, requestMedia, type MediaErrorKey } from "@/lib/media/actions";
import { CREATOR_SKILLS } from "@/lib/portfolio/skills";
import type { MediaStatus } from "@/lib/data/media";
import { cn } from "@/lib/cn";

const STATUS_STYLE: Record<MediaStatus, string> = {
  pending: "bg-white/10 text-white",
  approved: "bg-accent text-ink",
  rejected: "bg-danger-soft text-danger",
  cancelled: "bg-white/10 text-night-subtle",
};

/** Přihláška Creatora jako média (tmavá sekce eventu). */
export function MediaRequestBox({
  eventId,
  email,
  defaultSkills,
  hasUsername,
  request,
}: {
  eventId: string;
  email: string;
  defaultSkills: string[];
  hasUsername: boolean;
  request: { id: string; status: MediaStatus; decisionMessage: string | null } | null;
}) {
  const t = useTranslations("Media");
  const tErrors = useTranslations("MediaErrors");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<MediaErrorKey | null>(null);
  const [pending, startTransition] = useTransition();

  if (request) {
    return (
      <div className="flex flex-col gap-3 rounded-card bg-night-soft p-5 ring-1 ring-accent/30 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-semibold text-white">{t("myRequest")}</p>
          <span className={cn("rounded-full px-3 py-1 text-xs font-bold", STATUS_STYLE[request.status])}>
            {t(`status.${request.status}`)}
          </span>
        </div>
        <p className="text-sm text-night-subtle">{t(`statusText.${request.status}`)}</p>
        {request.decisionMessage ? (
          <p className="rounded-control bg-white/5 p-3 text-sm text-white/80">
            {t("organizerMessage")}: {request.decisionMessage}
          </p>
        ) : null}
        {error ? <Alert tone="error">{tErrors(error)}</Alert> : null}
        {request.status === "pending" || request.status === "approved" ? (
          confirmCancel ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-white">{t("cancelQuestion")}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await cancelMediaRequest(request.id);
                    if (res.ok) router.refresh();
                    else setError(res.error);
                  })
                }
                className="h-10 rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("cancelYes")}
              </button>
              <button type="button" onClick={() => setConfirmCancel(false)} className="text-sm font-semibold text-white">
                {tCommon("cancel")}
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="text-sm font-semibold text-white underline decoration-white/40 underline-offset-4"
              >
                {t("cancel")}
              </button>
            </div>
          )
        ) : null}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-card bg-night-soft p-5 ring-1 ring-accent/30 sm:p-6">
        <p className="text-white">{t("ctaText")}</p>
        <Button type="button" onClick={() => setOpen(true)}>
          📸 {t("cta")}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const res = await requestMedia({
            eventId,
            phone: String(fd.get("phone") ?? ""),
            email: String(fd.get("email") ?? ""),
            message: String(fd.get("message") ?? ""),
            skills: fd.getAll("skills").map(String),
            consent: fd.get("consent") === "on",
          });
          if (res.ok) router.refresh();
          else setError(res.error);
        });
      }}
      className="flex flex-col gap-5 rounded-card bg-surface p-5 text-ink sm:p-6"
    >
      <p className="font-display text-2xl font-extrabold uppercase">{t("formTitle")}</p>
      <p className="-mt-3 text-sm text-ink-soft">{t("formIntro")}</p>
      {!hasUsername ? <Alert tone="info">{tErrors("username_required")}</Alert> : null}
      {error ? <Alert tone="error">{tErrors(error)}</Alert> : null}
      <div>
        <p className="mb-2 text-sm font-medium text-ink">{t("skillsLabel")}</p>
        <div className="flex flex-wrap gap-2">
          {CREATOR_SKILLS.map((skill) => (
            <label
              key={skill}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white"
            >
              <input
                type="checkbox"
                name="skills"
                value={skill}
                defaultChecked={defaultSkills.includes(skill)}
                className="sr-only"
              />
              {t(`skills.${skill}`)}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("phoneLabel")} name="phone" type="tel" autoComplete="tel" required minLength={5} maxLength={30} />
        <Field label={t("emailLabel")} name="email" type="email" autoComplete="email" required defaultValue={email} maxLength={254} />
      </div>
      <TextareaField
        label={t("messageLabel")}
        name="message"
        rows={3}
        maxLength={1000}
        hint={t("messageHint")}
      />
      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 shrink-0 accent-ink" />
        <span>{t("consent")}</span>
      </label>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending || !hasUsername}>
          {pending ? tCommon("saving") : t("submit")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {tCommon("cancel")}
        </Button>
      </div>
    </form>
  );
}
