import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getMyProfile } from "@/lib/data/profiles";
import { PageShell } from "@/components/page-shell";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-form";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Profile");
  return { title: t("editTitle"), robots: { index: false } };
}

export default async function EditProfilePage() {
  const [t, tAuth] = await Promise.all([
    getTranslations("Profile"),
    getTranslations("Auth"),
  ]);
  return (
    <PageShell
      title={t("editTitle")}
      subtitle={
        <Link href="/account" className={textLinkClass}>
          {t("backToAccount")}
        </Link>
      }
    >
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <EditProfileContent />
      </Suspense>
    </PageShell>
  );
}

async function EditProfileContent() {
  const [t, locale, profile] = await Promise.all([
    getTranslations("Profile"),
    getLocale(),
    getMyProfile(),
  ]);
  if (!profile) return redirect({ href: "/login", locale });

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="mb-4 text-lg font-semibold">{t("avatarTitle")}</h2>
        <AvatarUploader
          userId={profile.id}
          name={profile.display_name ?? profile.username ?? ""}
          avatarUrl={profile.avatarUrl}
        />
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold">{t("detailsTitle")}</h2>
        <ProfileForm
          values={{
            username: profile.username ?? "",
            display_name: profile.display_name ?? "",
            country: profile.country ?? "",
            city: profile.city ?? "",
            bio: profile.bio ?? "",
            visibility: profile.visibility,
            social: {
              website_url: profile.website_url,
              instagram_url: profile.instagram_url,
              tiktok_url: profile.tiktok_url,
              youtube_url: profile.youtube_url,
              facebook_url: profile.facebook_url,
            },
          }}
        />
      </section>
    </div>
  );
}
