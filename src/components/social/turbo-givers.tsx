import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { TurboGiver } from "@/lib/data/social";
import { Avatar } from "@/components/avatar";
import { TurboIcon } from "./turbo-icon";

/**
 * „Turbo dali: @a, @b a 12 dalších“ – avatary a jména (jen veřejné profily).
 * `total` = počet lidí (u fotky a garáže přesný, včetně soukromých profilů).
 * Bez `total` (u celého auta) se místo čísla napíše jen „a další“.
 */
export async function TurboGivers({ givers, total }: { givers: TurboGiver[]; total?: number }) {
  if (givers.length === 0 && !total) return null;
  const t = await getTranslations("Social");
  const named = givers.slice(0, 3);
  const others = total === undefined ? (givers.length > named.length ? -1 : 0) : Math.max(0, total - named.length);

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-night-subtle">
      <TurboIcon className="h-5 w-5 text-accent" />
      {givers.length ? (
        <div className="flex -space-x-2">
          {givers.slice(0, 6).map((g) => (
            <Link key={g.username} href={`/u/${g.username}`} title={`@${g.username}`} className="rounded-full ring-2 ring-night">
              <Avatar url={g.avatarUrl} name={g.displayName ?? g.username} size={28} />
            </Link>
          ))}
        </div>
      ) : null}
      <p>
        <span className="text-white/85">{t("giversTitle")}</span>{" "}
        {named.map((g, i) => (
          <span key={g.username}>
            {i > 0 ? ", " : ""}
            <Link href={`/u/${g.username}`} className="font-semibold text-white hover:text-accent">
              @{g.username}
            </Link>
          </span>
        ))}
        {named.length && others ? " " : ""}
        {others === -1
          ? t("andMore")
          : others
            ? named.length
              ? t("andOthers", { count: others })
              : t("members", { count: others })
            : ""}
      </p>
    </div>
  );
}
