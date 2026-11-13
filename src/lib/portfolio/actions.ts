"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_MEDIA_BUCKET, portfolioPath, profileCoverPath } from "@/lib/storage";
import { parseVideoUrl } from "@/lib/portfolio/video";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIZES = ["sm", "md", "lg"] as const;

export type PortfolioError =
  | "notCreator"
  | "videoInvalid"
  | "captionTooLong"
  | "portfolioLimit"
  | "pinLimit"
  | "notAllowed"
  | "generic";

export type PortfolioResult = { ok: true } | { ok: false; error: PortfolioError };

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, userId: data.user.id } : null;
}

function toError(message: string | undefined): PortfolioResult {
  if (message === "portfolio_limit") return { ok: false, error: "portfolioLimit" };
  if (message === "pin_limit") return { ok: false, error: "pinLimit" };
  if (message?.includes("row-level security")) return { ok: false, error: "notCreator" };
  return { ok: false, error: "generic" };
}

function format(value: string): "webp" | "jpg" {
  return value === "jpg" ? "jpg" : "webp";
}

function cleanCaption(value: string | undefined): string | null | undefined {
  const c = (value ?? "").trim();
  if (c.length > 300) return undefined;
  return c || null;
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------
// Úvodní (cover) fotka profilu
// ---------------------------------------------------------------------

/** Zapíše cover, který prohlížeč nahrál do úložiště; starý smaže. */
export async function setProfileCover(input: { key: string; format: string }): Promise<{ ok: boolean }> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(input.key)) return { ok: false };
  const { data: current } = await ctx.supabase
    .from("profiles")
    .select("cover_key, cover_format")
    .eq("id", ctx.userId)
    .single();
  const { error } = await ctx.supabase
    .from("profiles")
    .update({ cover_key: input.key, cover_format: format(input.format) })
    .eq("id", ctx.userId);
  if (error) return { ok: false };
  if (current?.cover_key && current.cover_format && current.cover_key !== input.key) {
    await ctx.supabase.storage
      .from(PROFILE_MEDIA_BUCKET)
      .remove(SIZES.map((s) => profileCoverPath(ctx.userId, current.cover_key!, s, current.cover_format!)));
  }
  refresh();
  return { ok: true };
}

export async function removeProfileCover(): Promise<{ ok: boolean }> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false };
  const { data: current } = await ctx.supabase
    .from("profiles")
    .select("cover_key, cover_format")
    .eq("id", ctx.userId)
    .single();
  const { error } = await ctx.supabase
    .from("profiles")
    .update({ cover_key: null, cover_format: null })
    .eq("id", ctx.userId);
  if (error) return { ok: false };
  if (current?.cover_key && current.cover_format) {
    await ctx.supabase.storage
      .from(PROFILE_MEDIA_BUCKET)
      .remove(SIZES.map((s) => profileCoverPath(ctx.userId, current.cover_key!, s, current.cover_format!)));
  }
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------

/** Zapíše fotku, kterou prohlížeč nahrál (id práce i klíč souboru vybral prohlížeč). */
export async function addPortfolioPhoto(input: {
  itemId: string;
  key: string;
  format: string;
  width: number;
  height: number;
}): Promise<PortfolioResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(input.itemId) || !UUID.test(input.key)) return { ok: false, error: "notAllowed" };
  const { error } = await ctx.supabase.from("portfolio_items").insert({
    id: input.itemId,
    owner_id: ctx.userId,
    kind: "photo",
    photo_key: input.key,
    photo_format: format(input.format),
    width: Math.max(1, Math.round(input.width)) || null,
    height: Math.max(1, Math.round(input.height)) || null,
  });
  if (error) {
    await ctx.supabase.storage
      .from(PROFILE_MEDIA_BUCKET)
      .remove(SIZES.map((s) => portfolioPath(ctx.userId, input.itemId, input.key, s, format(input.format))));
    return toError(error.message);
  }
  refresh();
  return { ok: true };
}

/** Přidá video odkazem (YouTube, Instagram, TikTok, Vimeo). */
export async function addPortfolioVideo(input: { url: string; caption?: string }): Promise<PortfolioResult> {
  const parsed = parseVideoUrl(input.url ?? "");
  if (!parsed) return { ok: false, error: "videoInvalid" };
  const caption = cleanCaption(input.caption);
  if (caption === undefined) return { ok: false, error: "captionTooLong" };
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "notAllowed" };
  const { error } = await ctx.supabase.from("portfolio_items").insert({
    owner_id: ctx.userId,
    kind: "video",
    video_url: parsed.url,
    video_provider: parsed.provider,
    caption,
  });
  if (error) return toError(error.message);
  refresh();
  return { ok: true };
}

/** Popisek nebo připíchnutí práce. */
export async function updatePortfolioItem(input: {
  id: string;
  caption?: string;
  pinned?: boolean;
}): Promise<PortfolioResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(input.id)) return { ok: false, error: "notAllowed" };
  const patch: { caption?: string | null; pinned?: boolean } = {};
  if (input.caption !== undefined) {
    const caption = cleanCaption(input.caption);
    if (caption === undefined) return { ok: false, error: "captionTooLong" };
    patch.caption = caption;
  }
  if (input.pinned !== undefined) patch.pinned = Boolean(input.pinned);
  const { data, error } = await ctx.supabase
    .from("portfolio_items")
    .update(patch)
    .eq("id", input.id)
    .eq("owner_id", ctx.userId)
    .select("id");
  if (error) return toError(error.message);
  if (!data?.length) return { ok: false, error: "notAllowed" };
  refresh();
  return { ok: true };
}

/** Vlastní náhled videa (nahraný prohlížečem); starý smaže. */
export async function setPortfolioThumb(input: { id: string; key: string; format: string }): Promise<PortfolioResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(input.id) || !UUID.test(input.key)) return { ok: false, error: "notAllowed" };
  const { data: item } = await ctx.supabase
    .from("portfolio_items")
    .select("id, kind, photo_key, photo_format")
    .eq("id", input.id)
    .eq("owner_id", ctx.userId)
    .maybeSingle();
  if (!item || item.kind !== "video") return { ok: false, error: "notAllowed" };
  const { error } = await ctx.supabase
    .from("portfolio_items")
    .update({ photo_key: input.key, photo_format: format(input.format) })
    .eq("id", input.id);
  if (error) return toError(error.message);
  if (item.photo_key && item.photo_format) {
    await ctx.supabase.storage
      .from(PROFILE_MEDIA_BUCKET)
      .remove(SIZES.map((s) => portfolioPath(ctx.userId, item.id, item.photo_key!, s, item.photo_format!)));
  }
  refresh();
  return { ok: true };
}

/** Smaže práci i její soubory. */
export async function deletePortfolioItem(id: string): Promise<PortfolioResult> {
  const ctx = await requireUser();
  if (!ctx || !UUID.test(id)) return { ok: false, error: "notAllowed" };
  const { data: item } = await ctx.supabase
    .from("portfolio_items")
    .select("id, photo_key, photo_format")
    .eq("id", id)
    .eq("owner_id", ctx.userId)
    .maybeSingle();
  if (!item) return { ok: false, error: "notAllowed" };
  const { error } = await ctx.supabase.from("portfolio_items").delete().eq("id", id);
  if (error) return { ok: false, error: "generic" };
  if (item.photo_key && item.photo_format) {
    await ctx.supabase.storage
      .from(PROFILE_MEDIA_BUCKET)
      .remove(SIZES.map((s) => portfolioPath(ctx.userId, item.id, item.photo_key!, s, item.photo_format!)));
  }
  refresh();
  return { ok: true };
}
