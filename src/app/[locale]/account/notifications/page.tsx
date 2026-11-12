import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/dates";
import { listMyNotifications, type Notification } from "@/lib/data/notifications";
import { getMyProfile } from "@/lib/data/profiles";
import { fillPlaceholders } from "@/lib/email/placeholders";
import { PageShell } from "@/components/page-shell";
import { MarkNotificationsRead } from "@/components/notifications/mark-read";
import { textLinkClass } from "@/components/auth/auth-shell";
import { cn } from "@/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Notifications");
  return { title: t("title"), robots: { index: false } };
}

export default async function NotificationsPage() {
  const [t, tAuth] = await Promise.all([getTranslations("Notifications"), getTranslations("Auth")]);
  return (
    <PageShell
      title={t("title")}
      subtitle={
        <Link href="/account" className={textLinkClass}>
          {t("backToAccount")}
        </Link>
      }
    >
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <NotificationsList />
      </Suspense>
    </PageShell>
  );
}

type Payload = {
  event_title?: string;
  event_slug?: string;
  vehicle?: string;
  subject?: string;
  body?: string;
  name?: string;
  // turba
  target?: "vehicle" | "garage";
  vehicle_id?: string;
  givers?: string[];
  count?: number;
  // sledování
  username?: string | null;
  display_name?: string | null;
  // crew
  crew_name?: string;
  crew_slug?: string;
  reason?: string | null;
  // pořadatelé
  organizer_name?: string;
  organizer_slug?: string;
  // odznaky
  name_cs?: string;
  name_en?: string;
};

type Described = {
  title: string;
  text: string;
  href: string | null;
  linkLabel?: string;
  eventTitle?: string;
};

async function NotificationsList() {
  const [t, locale, items, me] = await Promise.all([
    getTranslations("Notifications"),
    getLocale(),
    listMyNotifications(),
    getMyProfile(),
  ]);
  const hasUnread = items.some((n) => !n.read_at);

  if (items.length === 0) {
    return <p className="rounded-card bg-muted p-8 text-ink-soft">{t("empty")}</p>;
  }

  const myGarage = me?.username ? `/u/${me.username}` : "/account";

  const describe = (n: Notification): Described => {
    const p = (n.payload ?? {}) as Payload;
    const vars = { event: p.event_title ?? "", vehicle: p.vehicle ?? "" };
    switch (n.type) {
      case "broadcast":
        return {
          title: p.subject ?? t("broadcastTitle"),
          text: fillPlaceholders(p.body ?? "", p.name ?? "", p.event_title ?? ""),
          href: p.event_slug ? `/e/${p.event_slug}` : null,
          linkLabel: t("openEvent"),
          eventTitle: p.event_title,
        };
      case "turbo_received": {
        // „@a, @b a 3 další“ – jména jen veřejných profilů, zbytek číslem
        const count = p.count ?? 1;
        const names = (p.givers ?? []).map((u) => `@${u}`);
        const others = count - names.length;
        const who = names.length
          ? `${names.join(", ")}${others > 0 ? ` ${t("andOthers", { count: others })}` : ""}`
          : t("someone", { count });
        const vehicle = p.vehicle ?? "";
        return p.target === "vehicle" && p.vehicle_id
          ? {
              title: t("turboVehicleTitle", { vehicle }),
              text: t("turboVehicleText", { who, vehicle, count }),
              href: `/v/${p.vehicle_id}`,
              linkLabel: t("openVehicle"),
            }
          : {
              title: t("turboGarageTitle"),
              text: t("turboGarageText", { who, count }),
              href: myGarage,
              linkLabel: t("openGarage"),
            };
      }
      case "new_follower":
        return {
          title: t("followerTitle"),
          text: p.username
            ? t("followerText", { name: p.display_name ?? `@${p.username}` })
            : t("followerAnonymous"),
          href: p.username ? `/u/${p.username}` : null,
          linkLabel: t("openProfile"),
        };
      case "badge_awarded":
        return {
          title: t("badgeTitle"),
          text: t("badgeText", { badge: (locale === "en" ? p.name_en : p.name_cs) ?? "" }),
          href: `${myGarage}#sin-slavy`,
          linkLabel: t("openHallOfFame"),
        };
      case "organizer_event_published":
      case "organizer_registration_open":
      case "organizer_event_cancelled": {
        const v = { event: p.event_title ?? "", organizer: p.organizer_name ?? "" };
        return {
          title: t(`types.${n.type}.title`, v),
          text: t(`types.${n.type}.text`, v),
          href: p.event_slug ? `/e/${p.event_slug}` : null,
          linkLabel: t("openEvent"),
        };
      }
      case "crew_review":
      case "crew_approved":
      case "crew_rejected":
      case "crew_join_request":
      case "crew_member_approved":
      case "crew_organizer_request":
      case "crew_organizer_approved": {
        const v = {
          crew: p.crew_name ?? "",
          name: p.display_name ?? (p.username ? `@${p.username}` : ""),
          reason: p.reason ?? "",
        };
        const href =
          n.type === "crew_review" || n.type === "crew_organizer_request"
            ? "/admin/crews"
            : n.type === "crew_organizer_approved"
              ? "/organizer"
            : n.type === "crew_rejected"
              ? "/crews"
              : p.crew_slug
                ? `/c/${p.crew_slug}${n.type === "crew_join_request" ? "#zadosti" : ""}`
                : null;
        return {
          title: t(`types.${n.type}.title`, v),
          text: n.type === "crew_rejected" && p.reason
            ? `${t("types.crew_rejected.text", v)} ${t("crewReason", v)}`
            : t(`types.${n.type}.text`, v),
          href,
          linkLabel:
            n.type === "crew_review" || n.type === "crew_organizer_request"
              ? t("openCrewReview")
              : n.type === "crew_organizer_approved"
                ? t("openOrganizer")
                : t("openCrew"),
        };
      }
      default:
        return {
          title: t(`types.${n.type}.title`, vars),
          text: t(`types.${n.type}.text`, vars),
          href: "/account/registrations",
          linkLabel: t("openRegistrations"),
          eventTitle: p.event_title,
        };
    }
  };

  return (
    <>
      <MarkNotificationsRead hasUnread={hasUnread} />
      <ul className="flex flex-col gap-3">
        {items.map((n) => {
          const d = describe(n);
          return (
            <li
              key={n.id}
              className={cn(
                "rounded-card border p-5",
                n.read_at ? "border-line" : "border-ink bg-muted",
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-ink">
                  {!n.read_at ? (
                    <span aria-hidden className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" />
                  ) : null}
                  {d.title}
                </p>
                <span className="text-xs text-subtle">{formatDateTime(n.created_at, locale)}</span>
              </div>
              {n.type === "broadcast" && d.eventTitle ? (
                <p className="mt-0.5 text-sm text-subtle">{d.eventTitle}</p>
              ) : null}
              <p className="mt-2 whitespace-pre-line text-ink-soft">{d.text}</p>
              {d.href ? (
                <Link href={d.href} className={cn(textLinkClass, "mt-3 inline-block text-sm")}>
                  {d.linkLabel}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
