"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { switchOrganizer } from "@/lib/organizer/actions";
import { cn } from "@/lib/cn";

/** Přepínač: za koho právě spravuji eventy (já / moje crew). */
export function OrganizerSwitcher({
  options,
  currentId,
}: {
  options: Array<{ id: string; name: string; isCrew: boolean }>;
  currentId: string;
}) {
  const t = useTranslations("Organizer");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (options.length < 2) return null;
  return (
    <div className="mb-8 rounded-card bg-muted p-4">
      <p className="mb-2 text-sm font-semibold text-ink">{t("managingAs")}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={pending}
            aria-pressed={o.id === currentId}
            onClick={() =>
              startTransition(async () => {
                await switchOrganizer(o.id);
                router.refresh();
              })
            }
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
              o.id === currentId ? "bg-ink text-white" : "bg-white text-ink hover:bg-line",
            )}
          >
            {o.isCrew ? "Crew · " : ""}
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}
