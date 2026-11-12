"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { joinCrew, leaveCrew, setHomeCrew, type CrewError } from "@/lib/crews/actions";
import { Button, buttonClasses } from "@/components/ui/button";

/** Přidat se / Žádost odeslána / Jsem člen (domovská crew, odejít). */
export function CrewMembership({
  crewId,
  status,
  role,
  isHome,
  joinPolicy,
  signedIn,
}: {
  crewId: string;
  status: "none" | "pending" | "active";
  role: "founder" | "admin" | "member" | null;
  isHome: boolean;
  joinPolicy: "open" | "approval";
  signedIn: boolean;
}) {
  const t = useTranslations("Crews");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<CrewError | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: CrewError }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok && res.error) setError(res.error);
      router.refresh();
    });
  };

  if (!signedIn) {
    return (
      <Link href="/login" className={buttonClasses("primary", "lg")}>
        {joinPolicy === "open" ? t("join") : t("requestJoin")}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {status === "none" ? (
          <Button size="lg" disabled={pending} onClick={() => run(() => joinCrew(crewId))}>
            {joinPolicy === "open" ? t("join") : t("requestJoin")}
          </Button>
        ) : null}
        {status === "pending" ? (
          <>
            <span className="rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white">{t("requestSent")}</span>
            <Button variant="outlineDark" disabled={pending} onClick={() => run(() => leaveCrew(crewId))}>
              {t("cancelRequest")}
            </Button>
          </>
        ) : null}
        {status === "active" ? (
          <>
            <span className="rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-ink">
              {role === "founder" ? t("youFounder") : role === "admin" ? t("youAdmin") : t("youMember")}
            </span>
            {isHome ? (
              <span className="text-sm text-night-subtle">🏠 {t("isHome")}</span>
            ) : (
              <Button variant="outlineDark" disabled={pending} onClick={() => run(() => setHomeCrew(crewId))}>
                🏠 {t("setHome")}
              </Button>
            )}
            {role !== "founder" ? (
              <Button
                variant="outlineDark"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(t("leaveConfirm"))) run(() => leaveCrew(crewId));
                }}
              >
                {t("leave")}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      {error ? <p className="text-sm font-semibold text-accent">{t(`errors.${error}`)}</p> : null}
    </div>
  );
}
