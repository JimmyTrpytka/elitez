"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  deleteVehicle,
  markVehicleSold,
  restoreVehicle,
  setVehicleVisibility,
} from "@/lib/garage/actions";

/** Viditelnost, „Prodáno“ / návrat z archivu a smazání vozidla. */
export function VehicleSettings({
  vehicleId,
  visibility,
  status,
}: {
  vehicleId: string;
  visibility: "public" | "private";
  status: "current" | "former";
}) {
  const t = useTranslations("VehicleSettings");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [soldOpen, setSoldOpen] = useState(false);
  const [soldOn, setSoldOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [confirmDelete, setConfirmDelete] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error === "hasEventHistory" ? t("deleteBlocked") : t("failed"));
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* Viditelnost */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{t("visibilityTitle")}</p>
          <p className="text-sm text-ink-soft">
            {visibility === "public" ? t("isPublic") : t("isPrivate")}
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(() =>
              setVehicleVisibility(vehicleId, visibility === "public" ? "private" : "public"),
            )
          }
        >
          {visibility === "public" ? t("makePrivate") : t("makePublic")}
        </Button>
      </div>

      {/* Prodáno / návrat */}
      <div className="border-t border-line pt-6">
        {status === "current" ? (
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-semibold text-ink">{t("soldTitle")}</p>
              <p className="text-sm text-ink-soft">{t("soldText")}</p>
            </div>
            {soldOpen ? (
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
                  {t("soldOnLabel")}
                  <input
                    type="date"
                    value={soldOn}
                    onChange={(e) => setSoldOn(e.target.value)}
                    className="h-11 rounded-control border border-line px-3 text-base focus:border-ink focus:outline-none"
                  />
                </label>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => run(() => markVehicleSold(vehicleId, soldOn))}
                >
                  {t("soldConfirm")}
                </Button>
                <Button variant="ghost" onClick={() => setSoldOpen(false)}>
                  {tCommon("cancel")}
                </Button>
              </div>
            ) : (
              <div>
                <Button variant="secondary" onClick={() => setSoldOpen(true)}>
                  {t("soldButton")}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">{t("formerTitle")}</p>
              <p className="text-sm text-ink-soft">{t("formerText")}</p>
            </div>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => run(() => restoreVehicle(vehicleId))}
            >
              {t("restore")}
            </Button>
          </div>
        )}
      </div>

      {/* Smazání */}
      <div className="border-t border-line pt-6">
        <p className="font-semibold text-ink">{t("deleteTitle")}</p>
        <p className="mb-3 text-sm text-ink-soft">{t("deleteText")}</p>
        {confirmDelete ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteVehicle(vehicleId, locale))}
              className="h-11 rounded-full bg-danger px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {t("deleteConfirm")}
            </button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {tCommon("cancel")}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm font-semibold text-danger underline underline-offset-4"
          >
            {t("deleteButton")}
          </button>
        )}
      </div>
    </div>
  );
}
