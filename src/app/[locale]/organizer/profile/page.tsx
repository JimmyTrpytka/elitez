import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMyOrganizer } from "@/lib/data/events";
import { ORGANIZER_LOGOS_BUCKET, organizerLogoPath, signFiles } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/page-shell";
import { OrganizerProfileForm } from "@/components/organizer/organizer-profile-form";
import { OrganizerLogoUpload } from "@/components/organizer/organizer-logo-upload";
import { CoOrganizers } from "@/components/organizer/co-organizers";
import { getCurrentUser } from "@/lib/auth/user";
import { AVATARS_BUCKET } from "@/lib/storage";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OrganizerProfile");
  return { title: t("title"), robots: { index: false } };
}

export default async function OrganizerProfilePage() {
  const [t, tAuth] = await Promise.all([getTranslations("OrganizerProfile"), getTranslations("Auth")]);
  return (
    <PageShell
      title={t("title")}
      subtitle={
        <Link href="/organizer" className={textLinkClass}>
          {t("back")}
        </Link>
      }
    >
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <Content />
      </Suspense>
    </PageShell>
  );
}

async function Content() {
  const [t, organizer] = await Promise.all([getTranslations("OrganizerProfile"), getMyOrganizer()]);
  if (!organizer) notFound();
  let logoUrl: string | null = null;
  if (organizer.logo_key && organizer.logo_format) {
    const supabase = await createClient();
    const path = organizerLogoPath(organizer.id, organizer.logo_key, "md", organizer.logo_format);
    logoUrl = supabase ? ((await signFiles(supabase, ORGANIZER_LOGOS_BUCKET, [path])).get(path) ?? null) : null;
  }
  const [user, supabaseForMembers] = await Promise.all([getCurrentUser(), createClient()]);
  const [{ data: memberRows }, { data: canManage }] = supabaseForMembers
    ? await Promise.all([
        supabaseForMembers.rpc("organizer_member_list", { p_organizer_id: organizer.id }),
        supabaseForMembers.rpc("is_organizer_owner", { p_organizer_id: organizer.id }),
      ])
    : [{ data: [] }, { data: false }];
  const avatarPaths = (memberRows ?? []).map((m) => m.avatar_path).filter((x): x is string => Boolean(x));
  const avatarUrls = supabaseForMembers ? await signFiles(supabaseForMembers, AVATARS_BUCKET, avatarPaths) : new Map<string, string>();
  const coMembers = (memberRows ?? []).map((m) => ({
    userId: m.user_id,
    username: m.username ?? "",
    displayName: m.display_name,
    avatarUrl: m.avatar_path ? (avatarUrls.get(m.avatar_path) ?? null) : null,
  }));
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.elitezclub.eu").replace(/\/+$/, "");

  return (
    <div className="flex flex-col gap-12">
      <p>
        <Link href={`/o/${organizer.slug}`} className={textLinkClass}>
          {t("viewPublic")} →
        </Link>
      </p>
      <section>
        <h2 className="mb-4 font-display text-3xl font-extrabold text-ink uppercase">{t("logoTitle")}</h2>
        <OrganizerLogoUpload organizerId={organizer.id} name={organizer.name} logoUrl={logoUrl} />
      </section>
      <section>
        <h2 className="mb-4 font-display text-3xl font-extrabold text-ink uppercase">{t("coTitle")}</h2>
        <CoOrganizers members={coMembers} canManage={Boolean(canManage)} currentUserId={user?.id ?? ""} />
      </section>
      <section>
        <h2 className="mb-4 font-display text-3xl font-extrabold text-ink uppercase">{t("detailsTitle")}</h2>
        <OrganizerProfileForm
          siteUrl={site}
          values={{
            name: organizer.name,
            description: organizer.description ?? "",
            slug: organizer.slug,
            website_url: organizer.website_url ?? "",
            instagram_url: organizer.instagram_url ?? "",
            facebook_url: organizer.facebook_url ?? "",
            show_past_events: organizer.show_past_events,
          }}
        />
      </section>
    </div>
  );
}
