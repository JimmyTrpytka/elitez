import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/user";
import { PageShell } from "@/components/page-shell";
import { FeedbackForm } from "@/components/feedback/feedback-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Feedback");
  return { title: t("title"), robots: { index: false } };
}

export default async function FeedbackPage({ searchParams }: PageProps<"/[locale]/feedback">) {
  const [t, tAuth] = await Promise.all([getTranslations("Feedback"), getTranslations("Auth")]);
  return (
    <PageShell title={t("title")} subtitle={t("subtitle")}>
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <FeedbackContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function FeedbackContent({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/feedback">["searchParams"];
}) {
  const [{ from }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const page = typeof from === "string" && from.startsWith("/") ? from.slice(0, 300) : "";
  return <FeedbackForm from={page} signedIn={Boolean(user)} />;
}
