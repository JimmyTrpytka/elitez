import { createClient, type TypedSupabaseClient } from "@/lib/supabase/server";
import {
  EVENT_GALLERY_BUCKET,
  PROFILE_MEDIA_BUCKET,
  eventGalleryPath,
  portfolioPath,
  signFiles,
} from "@/lib/storage";
import { isVerticalVideo, videoEmbed } from "@/lib/portfolio/video";
import type { PortfolioItemView } from "@/lib/data/portfolio";

type WorkRow = {
  id: string;
  owner_id: string;
  kind: string;
  photo_key: string | null;
  photo_format: string | null;
  video_url: string | null;
  video_provider: string | null;
  caption: string | null;
  created_at: string;
  username: string | null;
  display_name: string | null;
  hidden?: boolean;
};

/** Práce z portfolií (galerie eventu, fotky u auta) → zobrazení s autorem. */
async function worksToViews(supabase: TypedSupabaseClient, rows: WorkRow[]): Promise<PortfolioItemView[]> {
  const paths: string[] = [];
  for (const r of rows) {
    if (r.photo_key && r.photo_format) {
      paths.push(portfolioPath(r.owner_id, r.id, r.photo_key, "md", r.photo_format));
      if (r.kind === "photo") paths.push(portfolioPath(r.owner_id, r.id, r.photo_key, "lg", r.photo_format));
    }
  }
  const urls = await signFiles(supabase, PROFILE_MEDIA_BUCKET, paths);
  return rows.map((r) => {
    const md = r.photo_key && r.photo_format ? portfolioPath(r.owner_id, r.id, r.photo_key, "md", r.photo_format) : null;
    const lg = r.photo_key && r.photo_format ? portfolioPath(r.owner_id, r.id, r.photo_key, "lg", r.photo_format) : null;
    const embed = r.kind === "video" && r.video_url && r.video_provider ? videoEmbed(r.video_provider, r.video_url) : null;
    const thumb = md ? (urls.get(md) ?? null) : null;
    return {
      id: r.id,
      kind: r.kind === "video" ? "video" : "photo",
      caption: r.caption,
      pinned: false,
      createdAt: r.created_at,
      width: null,
      height: null,
      thumbUrl: thumb ?? embed?.thumbnailUrl ?? null,
      fullUrl: lg ? (urls.get(lg) ?? null) : null,
      hasOwnThumb: Boolean(thumb),
      video: embed ? { ...embed, vertical: isVerticalVideo(embed.provider, embed.url) } : null,
      credit: r.username ? { username: r.username, name: r.display_name || r.username } : null,
      hidden: r.hidden ?? false,
      ownerId: r.owner_id,
      turboable: true,
    };
  });
}

export type EventGallery = {
  /** Fotky nahrané pořadatelem */
  organizer: PortfolioItemView[];
  /** Práce schválených médií (pořadatel vidí i skryté) */
  media: PortfolioItemView[];
};

/** Galerie eventu (RLS / funkce vrátí jen to, co čtenář smí vidět). */
export async function listEventGallery(eventId: string): Promise<EventGallery> {
  const supabase = await createClient();
  if (!supabase) return { organizer: [], media: [] };
  const [{ data: photos }, { data: works }] = await Promise.all([
    supabase
      .from("event_photos")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.rpc("event_media_works", { p_event_id: eventId }),
  ]);
  const rows = photos ?? [];
  const urls = await signFiles(
    supabase,
    EVENT_GALLERY_BUCKET,
    rows.flatMap((r) => [
      eventGalleryPath(r.event_id, r.id, r.photo_key, "md", r.photo_format),
      eventGalleryPath(r.event_id, r.id, r.photo_key, "lg", r.photo_format),
    ]),
  );
  const organizer = rows.map(
    (r): PortfolioItemView => ({
      id: r.id,
      kind: "photo",
      caption: r.caption,
      pinned: false,
      createdAt: r.created_at,
      width: r.width,
      height: r.height,
      thumbUrl: urls.get(eventGalleryPath(r.event_id, r.id, r.photo_key, "md", r.photo_format)) ?? null,
      fullUrl: urls.get(eventGalleryPath(r.event_id, r.id, r.photo_key, "lg", r.photo_format)) ?? null,
      hasOwnThumb: true,
      video: null,
      credit: null,
    }),
  );
  return { organizer, media: await worksToViews(supabase, works ?? []) };
}

/** Fotky od creatorů, na kterých je auto označené. */
export async function listVehicleCreatorWorks(vehicleId: string): Promise<PortfolioItemView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.rpc("vehicle_creator_works", { p_vehicle_id: vehicleId });
  return worksToViews(supabase, data ?? []);
}
