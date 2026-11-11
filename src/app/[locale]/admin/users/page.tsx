import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/page-shell";
import { RoleToggles } from "@/components/admin/role-toggles";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminUsers");
  return { title: t("title"), robots: { index: false } };
}

export default async function AdminUsersPage({ searchParams }: PageProps<"/[locale]/admin/users">) {
  const [t, tAuth] = await Promise.all([getTranslations("AdminUsers"), getTranslations("Auth")]);
  return (
    <PageShell
      width="lg"
      title={t("title")}
      subtitle={
        <Link href="/account" className={textLinkClass}>
          {t("backToAccount")}
        </Link>
      }
    >
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <UsersList searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

/** Seznam uživatelů – jen pro admina (kontroluje i databáze). */
async function UsersList({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/admin/users">["searchParams"];
}) {
  const [{ q }, t, locale, supabase] = await Promise.all([
    searchParams,
    getTranslations("AdminUsers"),
    getLocale(),
    createClient(),
  ]);
  if (!supabase) notFound();
  const search = typeof q === "string" ? q.slice(0, 100) : "";
  const [{ data, error }, { data: auth }] = await Promise.all([
    supabase.rpc("admin_list_users", { p_search: search || undefined, p_limit: 300 }),
    supabase.auth.getUser(),
  ]);
  if (error) notFound();
  const users = data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <form className="flex gap-2" role="search">
        <label htmlFor="user-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <input
          id="user-search"
          name="q"
          defaultValue={search}
          placeholder={t("searchPlaceholder")}
          className="h-11 min-w-0 flex-1 rounded-control border border-line px-4 text-base focus:border-ink focus:outline-none"
        />
        <button type="submit" className={buttonClasses("secondary")}>
          {t("search")}
        </button>
      </form>

      <p className="text-sm text-subtle">{t("count", { count: users.length })}</p>

      <ul className="flex flex-col gap-3">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex flex-col gap-3 rounded-card border border-line p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-ink">
                  {u.display_name ?? u.username ?? t("noName")}
                </p>
                {u.username ? (
                  <Link href={`/u/${u.username}`} className="text-sm text-subtle hover:text-ink">
                    @{u.username}
                  </Link>
                ) : null}
                {u.verified_at ? <Badge>Verified</Badge> : null}
                {u.visibility === "private" ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-ink-soft">
                    {t("private")}
                  </span>
                ) : null}
                {!u.email_confirmed ? (
                  <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
                    {t("unconfirmed")}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm break-all text-ink-soft">{u.email}</p>
              <p className="mt-0.5 text-xs text-subtle">
                {t("registered")} {formatDateTime(u.created_at, locale)}
                {" · "}
                {u.last_sign_in_at
                  ? `${t("lastSignIn")} ${formatDateTime(u.last_sign_in_at, locale)}`
                  : t("neverSignedIn")}
                {" · "}
                {t("vehicles", { count: Number(u.vehicle_count) })}
                {u.organizer_status === "suspended" ? ` · ${t("organizerSuspended")}` : ""}
              </p>
            </div>
            <RoleToggles
              userId={u.id}
              isAdmin={u.role === "admin"}
              isOrganizer={u.organizer_status === "approved"}
              isSelf={u.id === auth.user?.id}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
