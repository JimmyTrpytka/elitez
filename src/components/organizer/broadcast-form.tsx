"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sendBroadcast, type BroadcastFormState } from "@/lib/broadcasts/actions";
import { fillPlaceholders } from "@/lib/email/placeholders";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/cn";

type Segment = Enums<"broadcast_segment">;
const SEGMENTS: Segment[] = ["approved", "approved_verified", "pending", "waitlist", "all_active"];
const TEMPLATES = ["info", "change", "reminder"] as const;

const initial: BroadcastFormState = { status: "idle" };

export function BroadcastForm({
  eventId,
  eventTitle,
  counts,
}: {
  eventId: string;
  eventTitle: string;
  counts: Record<Segment, number>;
}) {
  const t = useTranslations("Broadcast");
  const [state, action, pending] = useActionState(sendBroadcast, initial);
  const [segment, setSegment] = useState<Segment>("approved");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const count = counts[segment] ?? 0;

  function applyTemplate(key: (typeof TEMPLATES)[number]) {
    setSubject(t.raw(`templates.${key}.subject`) as string);
    setBody(t.raw(`templates.${key}.body`) as string);
  }

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-start gap-4">
        <Alert tone="success">{t("sent", { count: state.count })}</Alert>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          {t("writeAnother")}
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="segment" value={segment} />
      {state.status === "error" ? <Alert tone="error">{t(`errors.${state.error}`)}</Alert> : null}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t("segmentLabel")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SEGMENTS.map((s) => (
            <label
              key={s}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-control border border-line p-4",
                "has-[:checked]:border-ink has-[:checked]:bg-muted",
              )}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="segment_choice"
                  checked={segment === s}
                  onChange={() => {
                    setSegment(s);
                    setConfirming(false);
                  }}
                  className="h-5 w-5 accent-ink"
                />
                <span className="font-semibold text-ink">{t(`segments.${s}`)}</span>
              </span>
              <span className="text-sm text-subtle">{t("people", { count: counts[s] ?? 0 })}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-subtle">{t("templatesLabel")}</span>
        {TEMPLATES.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => applyTemplate(key)}
            className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-ink hover:bg-line"
          >
            {t(`templates.${key}.label`)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="broadcast-subject" className="text-sm font-medium text-ink">
          {t("subjectLabel")}
        </label>
        <input
          id="broadcast-subject"
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={150}
          required
          className="h-12 rounded-control border border-line px-4 text-base focus:border-ink focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="broadcast-body" className="text-sm font-medium text-ink">
          {t("bodyLabel")}
        </label>
        <textarea
          id="broadcast-body"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          maxLength={5000}
          required
          className="rounded-control border border-line px-4 py-3 text-base focus:border-ink focus:outline-none"
        />
        <p className="text-xs text-subtle">{t("placeholdersHint")}</p>
      </div>

      {subject || body ? (
        <div className="rounded-card border border-line">
          <p className="border-b border-line px-5 py-3 text-xs font-semibold tracking-wide text-subtle uppercase">
            {t("preview")}
          </p>
          <div className="px-5 py-4">
            <p className="mb-3 text-lg font-semibold text-ink">{subject}</p>
            <p className="whitespace-pre-line text-ink-soft">
              {fillPlaceholders(body, t("exampleName"), eventTitle)}
            </p>
          </div>
        </div>
      ) : null}

      {confirming ? (
        <div className="flex flex-col gap-3 rounded-control bg-muted p-4">
          <p className="font-semibold text-ink">{t("confirmText", { count })}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? t("sending") : t("confirmSend")}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t("back")}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            variant="primary"
            size="lg"
            disabled={!subject.trim() || !body.trim() || count === 0}
            onClick={() => setConfirming(true)}
          >
            {t("send", { count })}
          </Button>
        </div>
      )}
    </form>
  );
}
