"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { addVehicleMod, deleteVehicleMod, updateVehicleMod } from "@/lib/garage/actions";
import type { VehicleMod } from "@/lib/data/vehicles";
import { Constants } from "@/lib/supabase/database.types";
import { LIMITS } from "@/lib/validation";

const fieldClass =
  "h-11 rounded-control border border-line bg-surface px-3 text-base text-ink placeholder:text-subtle focus:border-ink focus:outline-none";

function CategorySelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("Mods");
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {t("categoryLabel")}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${fieldClass} text-sm`}>
        {Constants.public.Enums.mod_category.map((c) => (
          <option key={c} value={c}>
            {t(`categories.${c}`)}
          </option>
        ))}
      </select>
    </>
  );
}

export function ModsManager({ vehicleId, mods }: { vehicleId: string; mods: VehicleMod[] }) {
  const t = useTranslations("Mods");
  const router = useRouter();
  const [category, setCategory] = useState<string>("engine");
  const [description, setDescription] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  // Rozpracovaná úprava existující položky
  const [editing, setEditing] = useState<{ id: string; category: string; description: string } | null>(null);

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

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editing.description.trim()) return;
    setFailed(false);
    const current = editing;
    startTransition(async () => {
      const result = await updateVehicleMod(current.id, current.category, current.description);
      if (result.ok) setEditing(null);
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
          {mods.map((m) =>
            editing?.id === m.id ? (
              <li key={m.id} className="px-4 py-3">
                <form onSubmit={save} className="flex flex-col gap-2 sm:flex-row">
                  <CategorySelect
                    id={`mod-edit-category-${m.id}`}
                    value={editing.category}
                    onChange={(v) => setEditing({ ...editing, category: v })}
                  />
                  <label className="sr-only" htmlFor={`mod-edit-${m.id}`}>
                    {t("descriptionLabel")}
                  </label>
                  <input
                    id={`mod-edit-${m.id}`}
                    autoFocus
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    maxLength={LIMITS.modDescription}
                    className={`${fieldClass} flex-1 px-4`}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={pending || !editing.description.trim()}>
                      {t("save")}
                    </Button>
                    <Button type="button" variant="secondary" disabled={pending} onClick={() => setEditing(null)}>
                      {t("cancel")}
                    </Button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={m.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
                <span className="w-28 shrink-0 text-sm text-subtle">
                  {t(`categories.${m.category}`)}
                </span>
                <span className="min-w-0 flex-1 text-ink">{m.description}</span>
                <span className="flex gap-4">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      setEditing({ id: m.id, category: m.category, description: m.description })
                    }
                    className="text-sm font-semibold text-ink underline-offset-4 hover:underline disabled:opacity-40"
                  >
                    {t("edit")}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(m.id)}
                    className="text-sm font-semibold text-danger disabled:opacity-40"
                  >
                    {t("delete")}
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="text-ink-soft">{t("empty")}</p>
      )}

      {failed ? <Alert tone="error">{t("failed")}</Alert> : null}

      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
        <CategorySelect id="mod-category" value={category} onChange={setCategory} />
        <label className="sr-only" htmlFor="mod-description">
          {t("descriptionLabel")}
        </label>
        <input
          id="mod-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={LIMITS.modDescription}
          placeholder={t("placeholder")}
          className={`${fieldClass} flex-1 px-4`}
        />
        <Button type="submit" variant="secondary" disabled={pending || !description.trim()}>
          {t("add")}
        </Button>
      </form>
    </div>
  );
}
