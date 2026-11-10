"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { addVehicleMod, deleteVehicleMod } from "@/lib/garage/actions";
import type { VehicleMod } from "@/lib/data/vehicles";
import { Constants } from "@/lib/supabase/database.types";
import { LIMITS } from "@/lib/validation";

export function ModsManager({ vehicleId, mods }: { vehicleId: string; mods: VehicleMod[] }) {
  const t = useTranslations("Mods");
  const router = useRouter();
  const [category, setCategory] = useState<string>("engine");
  const [description, setDescription] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setFailed(false);
    startTransition(async () => {
      const result = await addVehicleMod(vehicleId, category, description);
      if (result.ok) setDescription("");
      else setFailed(true);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteVehicleMod(id);
      if (!result.ok) setFailed(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {mods.length > 0 ? (
        <ul className="divide-y divide-line rounded-control border border-line">
          {mods.map((m) => (
            <li key={m.id} className="flex items-start gap-3 px-4 py-3">
              <span className="w-28 shrink-0 text-sm text-subtle">
                {t(`categories.${m.category}`)}
              </span>
              <span className="flex-1 text-ink">{m.description}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(m.id)}
                className="text-sm font-semibold text-danger disabled:opacity-40"
              >
                {t("delete")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft">{t("empty")}</p>
      )}

      {failed ? <Alert tone="error">{t("failed")}</Alert> : null}

      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="mod-category">
          {t("categoryLabel")}
        </label>
        <select
          id="mod-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-11 rounded-control border border-line bg-surface px-3 text-sm text-ink focus:border-ink focus:outline-none"
        >
          {Constants.public.Enums.mod_category.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="mod-description">
          {t("descriptionLabel")}
        </label>
        <input
          id="mod-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={LIMITS.modDescription}
          placeholder={t("placeholder")}
          className="h-11 flex-1 rounded-control border border-line bg-surface px-4 text-base text-ink placeholder:text-subtle focus:border-ink focus:outline-none"
        />
        <Button type="submit" variant="secondary" disabled={pending || !description.trim()}>
          {t("add")}
        </Button>
      </form>
    </div>
  );
}
