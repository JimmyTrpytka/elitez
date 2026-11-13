import { getTranslations } from "next-intl/server";
import { listEventGallery } from "@/lib/data/gallery";
import { PortfolioGallery } from "@/components/portfolio/portfolio-gallery";

/** Galerie na detailu eventu: fotky pořadatele + práce schválených médií. */
export async function EventGallerySection({ eventId, title }: { eventId: string; title: string }) {
  const [t, gallery] = await Promise.all([getTranslations("Gallery"), listEventGallery(eventId)]);
  const items = [...gallery.organizer, ...gallery.media.filter((m) => !m.hidden)];
  if (!items.length) return null;
  return (
    <section className="mb-12">
      <h2 className="mb-2 font-display text-3xl font-extrabold text-white uppercase">{t("title")}</h2>
      <p className="mb-6 text-night-subtle">{t("count", { count: items.length })}</p>
      <PortfolioGallery items={items} alt={title} />
    </section>
  );
}
