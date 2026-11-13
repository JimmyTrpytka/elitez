import { getTranslations } from "next-intl/server";
import { listEventGallery } from "@/lib/data/gallery";
import { PortfolioGallery } from "@/components/portfolio/portfolio-gallery";
import { getCurrentUser } from "@/lib/auth/user";
import { getPortfolioTurbos } from "@/lib/data/social";

/** Galerie na detailu eventu: fotky pořadatele + práce schválených médií. */
export async function EventGallerySection({ eventId, title }: { eventId: string; title: string }) {
  const [t, gallery] = await Promise.all([getTranslations("Gallery"), listEventGallery(eventId)]);
  const items = [...gallery.organizer, ...gallery.media.filter((m) => !m.hidden)];
  if (!items.length) return null;
  const [user, turbos] = await Promise.all([
    getCurrentUser(),
    getPortfolioTurbos(items.filter((i) => i.turboable).map((i) => i.id)),
  ]);
  return (
    <section className="mb-12">
      <h2 className="mb-2 font-display text-3xl font-extrabold text-white uppercase">{t("title")}</h2>
      <p className="mb-6 text-night-subtle">{t("count", { count: items.length })}</p>
      <PortfolioGallery
        items={items}
        alt={title}
        turbo={{ mode: user ? "active" : "guest", viewerId: user?.id ?? null, initial: turbos }}
      />
    </section>
  );
}
