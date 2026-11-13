"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/avatar";
import { Alert } from "@/components/ui/alert";
import { decideMediaRequest, type MediaErrorKey } from "@/lib/media/actions";
import type { MediaStatus } from "@/lib/data/media";
import { cn } from "@/lib/cn";

export type OrganizerMediaItem = {
  id: string;
  status: MediaStatus;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  skills: string[];
  phone: string;
  email: string;
  message: string | null;
  decisionMessage: string | null;
};

const STATUS_STYLE: Record<MediaStatus, string> = {
  pending: "bg-muted text-ink",
  approved: "bg-accent text-ink",
  rejected: "bg-danger-soft text-danger",
  cancelled: "bg-muted text-subtle",
};

/** Žádosti médií u pořadatele: schválit / zamítnout (se zprávou) / vrátit k posouzení. */
export function OrganizerMediaList({ items }: { items: OrganizerMediaItem[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <MediaRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

function MediaRow({ item }: { item: OrganizerMediaItem }) {
  const t = useTranslations("Media");
  const tErrors = useTranslations("MediaErrors");
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<MediaErrorKey | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (decision: "approved" | "rejected" | "pending") => {
    setError(null);
    startTransition(async () => {
      const res = await decideMediaRequest({ requestId: item.id, decision, message });
      if (res.ok) {
        setMessage("");
        router.refresh();
      } else setError(res.error);
    });
  };

  return (
    <li className="flex flex-col gap-3 rounded-card border border-line p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar url={item.avatarUrl} name={item.name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">
            {item.username ? (
              <Link href={`/u/${item.username}#portfolio`} className="underline underline-offset-4">
                {item.name}
              </Link>
            ) : (
              item.name
            )}
          </p>
          <p className="text-sm text-ink-soft">
            {item.skills.map((s) => (s === "photo" || s === "video" || s === "drone" ? t(`skills.${s}`) : s)).join(" · ") || "—"}
          </p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-bold", STATUS_STYLE[item.status])}>
          {t(`status.${item.status}`)}
        </span>
      </div>
      <p className="text-sm text-ink-soft">
        <a href={`tel:${item.phone}`} className="underline underline-offset-4">{item.phone}</a>
        {" · "}
        <a href={`mailto:${item.email}`} className="underline underline-offset-4">{item.email}</a>
      </p>
      {item.message ? <p className="rounded-control bg-muted p-3 text-sm text-ink">{item.message}</p> : null}
      {item.decisionMessage ? (
        <p className="text-sm text-subtle">
          {t("yourMessage")}: {item.decisionMessage}
        </p>
      ) : null}
      {error ? <Alert tone="error">{tErrors(error)}</Alert> : null}
      <input
        type="text"
        value={message}
        maxLength={1000}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("decisionPlaceholder")}
        aria-label={t("decisionPlaceholder")}
        className="h-10 w-full rounded-control border border-line px-3 text-sm text-ink placeholder:text-subtle focus:border-ink focus:outline-none"
      />
      <div className="flex flex-wrap gap-2">
        {item.status !== "approved" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => decide("approved")}
            className="h-10 rounded-full bg-accent px-4 text-sm font-semibold text-ink disabled:opacity-50"
          >
            {t("approve")}
          </button>
        ) : null}
        {item.status !== "rejected" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => decide("rejected")}
            className="h-10 rounded-full border border-line px-4 text-sm font-semibold text-danger disabled:opacity-50"
          >
            {t("reject")}
          </button>
        ) : null}
        {item.status !== "pending" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => decide("pending")}
            className="h-10 px-2 text-sm font-semibold text-ink underline underline-offset-4 disabled:opacity-50"
          >
            {t("backToPending")}
          </button>
        ) : null}
      </div>
    </li>
  );
}
