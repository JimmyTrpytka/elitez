import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { formatEventDates } from "@/lib/dates";
import { getEventBySlug } from "@/lib/data/events";
import {
  getMyRegistrationsForEvent,
  getRegistrationFormContext,
} from "@/lib/data/registrations";
import { registrationWindow } from "@/lib/registration-window";
import { PageShell } from "@/components/page-shell";
import { RegistrationForm } from "@/components/registrations/registration-form";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Registration");
  return { title: t("formTitle"), robots: { index: false } };
}

export default async function RegisterPage({
  params,
}: PageProps<"/[locale]/e/[slug]/register">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-2xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}
    >
      <RegisterContent params={params} />
    </Suspense>
  );
}

async function RegisterContent({
  params,
}: {
  params: PageProps<"/[locale]/e/[slug]/register">["params"];
}) {
  const { slug } = await params;
  const [t, locale, event, ctx] = await Promise.all([
    getTranslations("Registration"),
    getLocale(),
    getEventBySlug(decodeURIComponent(slug)),
    getRegistrationFormContext(),
  ]);
  if (!event) notFound();
  if (!ctx) {
    return redirect({
      href: { pathname: "/login", query: { next: `/${locale}/e/${event.slug}/register` } },
      locale,
    });
  }

  const back = (
    <Link href={`/e/${event.slug}`} className={textLinkClass}>
      ← {event.title}, {formatEventDates(event.starts_at, event.ends_at, locale, event.timezone)}
    </Link>
  );

  const win = registrationWindow(event, ctx.isVerified);
  let blocker: React.ReactNode = null;
  if (win.kind !== "open") {
    blocker = <Alert tone="info">{t("notOpenNow")}</Alert>;
  } else if (!ctx.username) {
    blocker = (
      <div className="flex flex-col items-start gap-4">
        <Alert tone="info">{t("needsUsername")}</Alert>
        <Link href="/account/profile" className={buttonClasses("secondary")}>
          {t("finishProfile")}
        </Link>
      </div>
    );
  } else if (ctx.vehicles.length === 0) {
    blocker = (
      <div className="flex flex-col items-start gap-4">
        <Alert tone="info">{t("needsVehicle")}</Alert>
        <Link href="/garage/new" className={buttonClasses("secondary")}>
          {t("addVehicle")}
        </Link>
      </div>
    );
  }

  const mine = blocker ? [] : await getMyRegistrationsForEvent(event.id);
  const taken = new Set(mine.filter((r) => r.status !== "cancelled").map((r) => r.vehicle_id));
  const vehicles = ctx.vehicles.map((v) => ({ ...v, alreadyRegistered: taken.has(v.id) }));
  if (!blocker && vehicles.every((v) => v.alreadyRegistered)) {
    blocker = <Alert tone="info">{t("allRegistered")}</Alert>;
  }

  return (
    <PageShell title={t("formTitle")} subtitle={back}>
      {blocker ?? (
        <RegistrationForm
          eventId={event.id}
          vehicles={vehicles}
          email={ctx.email}
          profilePrivate={ctx.profilePrivate}
          selectionCriteria={event.selection_criteria}
        />
      )}
    </PageShell>
  );
}
