import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/page-shell";
import { ResolveFeedbackButton } from "@/components/feedback/resolve-button";
import { cn } from "@/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FeedbackAdmin");
  return { title: t("title"), robots: { index: false } };
}

export default async function FeedbackAdminPage() {
  const [t, tAuth] = await Promise.all([getTranslations("FeedbackAdmin"), getTranslations("Auth")]);
  return (
    <PageShell title={t("title")} width="lg">
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <FeedbackList />
      </Suspense>
    </PageShell>
  );
}

/** Připomínky testerů – jen pro admina (kontroluje i databáze). */
async function FeedbackList() {
  const [t, locale, supabase] = await Promise.all([
    getTranslations("FeedbackAdmin"),
    getLocale(),
    createClient(),
  ]);
  if (!supabase) notFound();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) notFound();

  const { data } = await supabase
    .from("feedback")
    .select("*, author:profiles(username, display_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const items = data ?? [];
  const open = items.filter((f) => !f.resolved_at).length;

  if (items.length === 0) return <p className="rounded-card bg-muted p-8 text-ink-soft">{t("empty")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-soft">{t("summary", { open, total: items.length })}</p>
      <ul className="flex flex-col gap-3">
        {items.map((f) => (
          <li
            key={f.id}
            className={cn(
              "rounded-card border p-5",
              f.resolved_at ? "border-line opacity-60" : "border-ink",
            )}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-subtle">
              <span>
                {f.author
                  ? (f.author.display_name ?? `@${f.author.username ?? "?"}`)
                  : (f.contact_email ?? t("anonymous"))}
                {" · "}
                {formatDateTime(f.created_at, locale)}
                {f.page_path ? (
                  <>
                    {" · "}
                    <span className="font-mono">{f.page_path}</span>
                  </>
                ) : null}
              </span>
              <ResolveFeedbackButton id={f.id} resolved={Boolean(f.resolved_at)} />
            </div>
            <p className="whitespace-pre-line text-ink">{f.message}</p>
            {f.user_agent ? <p className="mt-2 truncate text-xs text-subtle">{f.user_agent}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
