import { createClient } from "@/lib/supabase/server";
import { PROFILE_MEDIA_BUCKET, portfolioPath, signFiles } from "@/lib/storage";
import { isVerticalVideo, videoEmbed, type VideoEmbed } from "@/lib/portfolio/video";

/** Kolik prací je vidět přímo na profilu; zbytek je v Archivu tvorby. */
export const PORTFOLIO_FEATURED = 12;

export type PortfolioItemView = {
  id: string;
  kind: "photo" | "video";
  caption: string | null;
  pinned: boolean;
  createdAt: string;
  width: number | null;
  height: number | null;
  /** Náhled (fotka nebo vlastní náhled videa) */
  thumbUrl: string | null;
  /** Velká fotka */
  fullUrl: string | null;
  hasOwnThumb: boolean;
  video: (VideoEmbed & { vertical: boolean }) | null;
  /** Autor (galerie eventu, fotky u auta) */
  credit?: { username: string; name: string } | null;
  /** Skryto pořadatelem v galerii eventu (vidí jen pořadatel) */
  hidden?: boolean;
  /** Označení (správa portfolia) */
  tags?: { eventId: string | null; eventTitle: string | null; vehicleId: string | null; vehicleName: string | null };
};

type Part = "featured" | "archive" | "all";

/**
 * Portfolio člena (RLS: cizí jen u veřejného profilu).
 * Pořadí: připíchnuté, pak nejnovější. Prvních 12 = profil, zbytek = archiv.
 */
export async function listPortfolio(
  ownerId: string,
  part: Part = "all",
): Promise<{ items: PortfolioItemView[]; total: number; archiveCount: number }> {
  const supabase = await createClient();
  if (!supabase) return { items: [], total: 0, archiveCount: 0 };
  const { data } = await supabase
    .from("portfolio_items")
    .select("*, event:events(title), vehicle:vehicles(make, model)")
    .eq("owner_id", ownerId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);
  const rows = data ?? [];
  const chosen =
    part === "featured"
      ? rows.slice(0, PORTFOLIO_FEATURED)
      : part === "archive"
        ? rows.slice(PORTFOLIO_FEATURED)
        : rows;

  const paths: string[] = [];
  for (const r of chosen) {
    if (r.photo_key && r.photo_format) {
      paths.push(portfolioPath(r.owner_id, r.id, r.photo_key, "md", r.photo_format));
      if (r.kind === "photo") paths.push(portfolioPath(r.owner_id, r.id, r.photo_key, "lg", r.photo_format));
    }
  }
  const urls = await signFiles(supabase, PROFILE_MEDIA_BUCKET, paths);

  const items = chosen.map((r): PortfolioItemView => {
    const md = r.photo_key && r.photo_format ? portfolioPath(r.owner_id, r.id, r.photo_key, "md", r.photo_format) : null;
    const lg = r.photo_key && r.photo_format ? portfolioPath(r.owner_id, r.id, r.photo_key, "lg", r.photo_format) : null;
    const embed = r.kind === "video" && r.video_url && r.video_provider ? videoEmbed(r.video_provider, r.video_url) : null;
    const ownThumb = md ? (urls.get(md) ?? null) : null;
    return {
      id: r.id,
      kind: r.kind === "video" ? "video" : "photo",
      caption: r.caption,
      pinned: r.pinned,
      createdAt: r.created_at,
      width: r.width,
      height: r.height,
      thumbUrl: ownThumb ?? embed?.thumbnailUrl ?? null,
      fullUrl: lg ? (urls.get(lg) ?? null) : null,
      hasOwnThumb: Boolean(ownThumb),
      video: embed ? { ...embed, vertical: isVerticalVideo(embed.provider, embed.url) } : null,
      tags: {
        eventId: r.event_id,
        eventTitle: r.event?.title ?? null,
        vehicleId: r.vehicle_id,
        vehicleName: r.vehicle ? `${r.vehicle.make} ${r.vehicle.model}` : null,
      },
    };
  });
  return { items, total: rows.length, archiveCount: Math.max(0, rows.length - PORTFOLIO_FEATURED) };
}
