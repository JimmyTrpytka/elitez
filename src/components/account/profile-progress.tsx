import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export type ProgressStepKey = "avatar" | "car" | "photos" | "turbo" | "follow" | "bio";
export type ProgressStep = { key: ProgressStepKey; done: boolean; href: string };

/**
 * „Dokonči profil“ – seznam prvních kroků s ukazatelem (jako LinkedIn).
 * Po splnění všech kroků se nezobrazí.
 */
export async function ProfileProgress({ steps }: { steps: ProgressStep[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const t = await getTranslations("Progress");
  const pct = Math.round((done / steps.length) * 100);
  const next = steps.find((s) => !s.done);

  return (
    <section className="rounded-card border border-line p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl leading-none font-extrabold text-ink uppercase">{t("title")}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t("subtitle")}</p>
        </div>
        <p className="font-display text-4xl leading-none font-extrabold text-ink tabular-nums">{pct} %</p>
      </div>
      <div
        className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={cn(
                "flex items-center gap-3 rounded-control px-3 py-2.5 transition-colors",
                s.done ? "text-subtle" : "text-ink hover:bg-muted",
                s.key === next?.key && "bg-muted font-semibold",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  s.done ? "bg-ink text-accent" : "border-2 border-line",
                )}
              >
                {s.done ? "✓" : ""}
              </span>
              <span className={cn(s.done && "line-through decoration-line")}>{t(`steps.${s.key}`)}</span>
              <span className="sr-only">{s.done ? t("done") : t("todo")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
