import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { EventView } from "@/lib/data/events";
import { getMediaContext, listEventMedia, mediaStatus } from "@/lib/data/media";
import { hasEnded } from "@/lib/dates";
import { Avatar } from "@/components/avatar";
import { MediaRequestBox } from "./media-request-box";

/**
 * Sekce „Média“ na detailu eventu: schválení fotografové a kameramani
 * (veřejně) a pro Creatory přihláška jako média.
 */
export async function MediaSection({ event }: { event: EventView }) {
  const [t, media, ctx] = await Promise.all([
    getTranslations("Media"),
    listEventMedia(event.id),
    getMediaContext(event.id),
  ]);
  const open = event.media_enabled && event.status === "published" && !hasEnded(event.starts_at);
  if (!media.length && !open) return null;

  const skillLabel = (s: string) => (s === "photo" || s === "video" || s === "drone" ? t(`skills.${s}`) : null);

  return (
    <section className="mb-12">
      <h2 className="mb-2 font-display text-3xl font-extrabold text-white uppercase">{t("title")}</h2>
      <p className="mb-6 max-w-2xl text-night-subtle">
        {media.length ? t("intro") : t("introEmpty")}
        {event.media_enabled && event.media_capacity ? ` ${t("capacity", { count: event.media_capacity })}` : ""}
      </p>

      {media.length ? (
        <ul className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((m) => (
            <li key={m.userId}>
              <Link
                href={`/u/${m.username}#portfolio`}
                className="flex items-center gap-3 rounded-card bg-night-soft p-3 ring-1 ring-white/10 transition-colors hover:ring-accent/50"
              >
                <Avatar url={m.avatarUrl} name={m.name} size={48} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-white">{m.name}</span>
                  <span className="block truncate text-sm text-night-subtle">
                    {[`@${m.username}`, ...m.skills.map(skillLabel).filter(Boolean)].join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {open && ctx ? (
        ctx.isCreator ? (
          <MediaRequestBox
            eventId={event.id}
            email={ctx.email}
            defaultSkills={ctx.skills}
            hasUsername={Boolean(ctx.username)}
            request={
              ctx.request
                ? {
                    id: ctx.request.id,
                    status: mediaStatus(ctx.request.status),
                    decisionMessage: ctx.request.decision_message,
                  }
                : null
            }
          />
        ) : (
          <p className="text-sm text-night-subtle">
            {t("notCreatorHint")}{" "}
            <Link
              href="/account/profile"
              className="font-semibold text-white underline decoration-accent decoration-2 underline-offset-4"
            >
              {t("becomeCreator")}
            </Link>
          </p>
        )
      ) : null}
      {open && !ctx ? (
        <p className="text-sm text-night-subtle">
          {t("guestHint")}{" "}
          <Link
            href="/login"
            className="font-semibold text-white underline decoration-accent decoration-2 underline-offset-4"
          >
            {t("login")}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
