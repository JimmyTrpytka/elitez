import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDreamYears, type DreamView } from "@/lib/data/dreams";
import { cn } from "@/lib/cn";
import { DREAM_STATUS_ICON } from "./dream-status";

/**
 * Karta snu. Bez fotky: tmavá karta se září a obrysovým názvem
 * (obrázky z internetu nepoužíváme).
 */
export async function DreamCard({
  dream,
  href,
  showVisibility = false,
}: {
  dream: DreamView;
  /** Odkaz karty (úprava ve správě); na profilu vede na propojené auto */
  href?: string;
  showVisibility?: boolean;
}) {
  const [t, tCommon] = await Promise.all([getTranslations("Dreams"), getTranslations("Common")]);
  const years = formatDreamYears(dream.yearFrom, dream.yearTo);
  const target = href ?? (dream.linked ? `/v/${dream.linked.vehicleId}` : undefined);

  const body = (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-night">
        {dream.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dream.photoUrl}
            alt={`${dream.make} ${dream.model}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="glow-accent flex h-full w-full flex-col items-center justify-center px-4 text-center">
            <span
              className="font-display text-5xl leading-none font-extrabold text-transparent uppercase sm:text-6xl"
              style={{ WebkitTextStroke: "1.5px rgb(255 214 10 / 0.55)" }}
            >
              {dream.make}
            </span>
            <span className="mt-2 text-xs font-semibold tracking-[0.3em] text-white/40 uppercase">
              {t("placeholder")}
            </span>
          </div>
        )}
        <span className="absolute top-3 left-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          <span aria-hidden>{DREAM_STATUS_ICON[dream.status]} </span>
          {t(`status.${dream.status}`)}
        </span>
        {showVisibility && dream.visibility === "private" ? (
          <span className="absolute top-3 right-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink">
            {tCommon("visibilityPrivate")}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="font-display text-2xl leading-tight font-extrabold text-white uppercase">
          {dream.make} {dream.model}
        </p>
        {years ? <p className="mt-0.5 text-sm text-night-subtle">{years}</p> : null}
        {dream.note ? <p className="mt-2 line-clamp-3 text-sm text-white/75">{dream.note}</p> : null}
        {dream.linked?.ownerUsername ? (
          <p className="mt-auto pt-3 text-xs font-semibold tracking-[0.12em] text-accent uppercase">
            {t("linkedFrom", { username: dream.linked.ownerUsername })}
          </p>
        ) : null}
      </div>
    </>
  );

  const className = cn(
    "group flex h-full flex-col overflow-hidden rounded-card bg-night-soft ring-1 ring-white/10",
    target && "transition-all duration-500 hover:-translate-y-1 hover:ring-accent/40",
  );
  return target ? (
    <Link href={target} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
