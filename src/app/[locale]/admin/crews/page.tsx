import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/page-shell";
import { AdminCrewActions } from "@/components/crews/admin-crew-actions";
import { textLinkClass } from "@/components/auth/auth-shell";
import { cn } from "@/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminCrews");
  return { title: t("title"), robots: { index: false } };
}

export default async function AdminCrewsPage() {
  const [t, tAuth] = await Promise.all([getTranslations("AdminCrews"), getTranslations("Auth")]);
  return (
    <PageShell title={t("title")} width="lg">
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <CrewList />
      </Suspense>
    </PageShell>
  );
}

/** Fronta schvalování crew – jen pro admina (kontroluje i databáze). */
async function CrewList() {
  const [t, locale, supabase] = await Promise.all([getTranslations("AdminCrews"), getLocale(), createClient()]);
  if (!supabase) notFound();
  const { data, error } = await supabase.rpc("admin_list_crews", {});
  if (error) notFound();
  const crews = data ?? [];
  // Ke zpracování: nové crew + žádosti o pořádání srazů
  const pending = crews.filter((c) => c.status === "pending" || (c.status === "approved" && c.organizer_requested_at));
  const others = crews.filter((c) => !pending.includes(c));

  const row = (c: (typeof crews)[number]) => (
    <li key={c.id} className="flex flex-col gap-4 rounded-card border border-line p-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold text-ink">{c.name}</p>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              c.status === "pending" ? "bg-accent text-ink" : c.status === "approved" ? "bg-ink text-white" : "bg-muted text-ink-soft",
            )}
          >
            {t(`status.${c.status}`)}
          </span>
        </div>
        {c.focus ? <p className="text-sm text-ink-soft">{c.focus}</p> : null}
        <p className="mt-1 text-sm text-subtle">
          {t("founder")}: {c.founder_name ?? c.founder_username} (@{c.founder_username}) · {t("members", { count: c.members })} ·{" "}
          {formatDateTime(c.created_at, locale)}
        </p>
        {c.description ? <p className="mt-2 max-w-2xl text-sm whitespace-pre-line text-ink-soft">{c.description}</p> : null}
        {c.status !== "rejected" ? (
          <Link href={`/c/${c.slug}`} className={cn(textLinkClass, "mt-2 inline-block text-sm")}>
            {t("open")}
          </Link>
        ) : null}
      </div>
      <AdminCrewActions
        crewId={c.id}
        status={c.status}
        organizerStatus={c.organizer_status}
        organizerRequested={Boolean(c.organizer_requested_at)}
      />
    </li>
  );

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="mb-4 text-xl font-semibold text-ink">{t("pendingTitle", { count: pending.length })}</h2>
        {pending.length ? <ul className="flex flex-col gap-3">{pending.map(row)}</ul> : <p className="text-ink-soft">{t("pendingEmpty")}</p>}
      </section>
      {others.length ? (
        <section>
          <h2 className="mb-4 text-xl font-semibold text-ink">{t("allTitle")}</h2>
          <ul className="flex flex-col gap-3">{others.map(row)}</ul>
        </section>
      ) : null}
    </div>
  );
}
