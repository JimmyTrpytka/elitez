"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setUserAdmin, setUserOrganizer } from "@/lib/admin/actions";
import { cn } from "@/lib/cn";

/** Přepínače rolí uživatele: Pořadatel a Administrátor (s potvrzením). */
export function RoleToggles({
  userId,
  isAdmin,
  isOrganizer,
  isSelf,
}: {
  userId: string;
  isAdmin: boolean;
  isOrganizer: boolean;
  isSelf: boolean;
}) {
  const t = useTranslations("AdminUsers");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(kind: "admin" | "organizer", next: boolean) {
    const question =
      kind === "admin"
        ? next
          ? t("confirmGrantAdmin")
          : t("confirmRevokeAdmin")
        : next
          ? t("confirmGrantOrganizer")
          : t("confirmRevokeOrganizer");
    if (!window.confirm(question)) return;
    setError(null);
    startTransition(async () => {
      const result =
        kind === "admin" ? await setUserAdmin(userId, next) : await setUserOrganizer(userId, next);
      if (!result.ok) setError(t(`errors.${result.error}`));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Toggle
          label={t("organizer")}
          on={isOrganizer}
          disabled={pending}
          onClick={() => toggle("organizer", !isOrganizer)}
        />
        <Toggle
          label={t("admin")}
          on={isAdmin}
          disabled={pending || (isSelf && isAdmin)}
          title={isSelf && isAdmin ? t("cannotDemoteSelf") : undefined}
          onClick={() => toggle("admin", !isAdmin)}
        />
      </div>
      {error ? <p className="text-xs font-semibold text-danger">{error}</p> : null}
    </div>
  );
}

function Toggle({
  label,
  on,
  disabled,
  title,
  onClick,
}: {
  label: string;
  on: boolean;
  disabled: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        on ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink hover:bg-muted",
      )}
    >
      <span
        aria-hidden
        className={cn("h-2.5 w-2.5 rounded-full", on ? "bg-accent" : "bg-line")}
      />
      {label}
    </button>
  );
}
