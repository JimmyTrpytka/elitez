import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { CrewListItem } from "@/lib/data/crews";
import { OrganizerLogo } from "@/components/organizers/organizer-logo";
import { TurboIcon } from "@/components/social/turbo-icon";

/** Karta crew v seznamu (tmavá). */
export async function CrewCard({ crew }: { crew: CrewListItem }) {
  const t = await getTranslations("Crews");
  return (
    <Link
      href={`/c/${crew.slug}`}
      className="group flex h-full flex-col gap-4 rounded-card bg-night-soft p-6 ring-1 ring-white/10 transition-all hover:-translate-y-1 hover:ring-accent/40"
    >
      <div className="flex items-center gap-4">
        <OrganizerLogo url={crew.logoUrl} name={crew.name} size={60} />
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight font-extrabold text-white uppercase">{crew.name}</p>
          {crew.focus ? <p className="truncate text-sm text-accent">{crew.focus}</p> : null}
        </div>
      </div>
      {crew.description ? <p className="line-clamp-2 text-sm text-white/70">{crew.description}</p> : null}
      <p className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-night-subtle">
        <span className="font-semibold text-white">{t("members", { count: crew.members })}</span>
        <span className="inline-flex items-center gap-1.5">
          <TurboIcon className="h-4 w-4 text-accent" />
          {crew.turbos}
        </span>
        <span>{crew.joinPolicy === "open" ? t("policyOpenShort") : t("policyApprovalShort")}</span>
      </p>
    </Link>
  );
}
