"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Lightbox, type LightboxPhoto } from "@/components/lightbox";
import { CloseIcon } from "@/components/icons";
import type { PortfolioItemView } from "@/lib/data/portfolio";
import { cn } from "@/lib/cn";
import { VideoProviderIcon } from "./video-provider-icon";

/**
 * Portfolio na profilu (tmavé): fotky otevře prohlížeč, videa se přehrají
 * až po klepnutí (do té doby se nic od YouTube/Instagramu nenačítá).
 */
export function PortfolioGallery({ items, alt }: { items: PortfolioItemView[]; alt: string }) {
  const t = useTranslations("Portfolio");
  const photos: LightboxPhoto[] = items
    .filter((i) => i.kind === "photo")
    .map((i) => ({ id: i.id, thumb: i.thumbUrl, full: i.fullUrl }));
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const [video, setVideo] = useState<PortfolioItemView | null>(null);

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id} className="group relative">
            <button
              type="button"
              onClick={() => {
                if (item.kind === "photo") setPhotoIndex(photos.findIndex((p) => p.id === item.id));
                else if (item.video?.embedUrl) setVideo(item);
                else if (item.video) window.open(item.video.url, "_blank", "noopener,noreferrer");
              }}
              aria-label={item.caption ?? (item.kind === "video" ? t("playVideo") : t("openPhoto"))}
              className="block w-full overflow-hidden rounded-control bg-night-soft focus-visible:outline-offset-4"
            >
              {item.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbUrl}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="glow-accent flex aspect-square w-full items-center justify-center text-white/60">
                  {item.video ? <VideoProviderIcon provider={item.video.provider} className="h-14 w-14" /> : null}
                </div>
              )}
              {item.video ? (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-ink shadow-lg transition-transform group-hover:scale-110">
                    <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6" fill="currentColor" aria-hidden>
                      <path d="M7 4.5v15l13-7.5-13-7.5Z" />
                    </svg>
                  </span>
                </span>
              ) : null}
              {item.video ? (
                <span className="pointer-events-none absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
                  <VideoProviderIcon provider={item.video.provider} className="h-4 w-4" />
                </span>
              ) : null}
              {item.pinned ? (
                <span className="pointer-events-none absolute top-2 left-2 text-sm" aria-label={t("pinned")}>
                  📌
                </span>
              ) : null}
            </button>
            {item.caption ? (
              <p className="mt-1.5 line-clamp-2 text-sm text-night-subtle">{item.caption}</p>
            ) : null}
          </li>
        ))}
      </ul>
      {photoIndex !== null && photoIndex >= 0 ? (
        <Lightbox
          photos={photos}
          index={photoIndex}
          onIndex={setPhotoIndex}
          onClose={() => setPhotoIndex(null)}
          alt={alt}
        />
      ) : null}
      {video?.video?.embedUrl ? <VideoModal item={video} onClose={() => setVideo(null)} /> : null}
    </>
  );
}

function VideoModal({ item, onClose }: { item: PortfolioItemView; onClose: () => void }) {
  const t = useTranslations("Portfolio");
  const tLightbox = useTranslations("Lightbox");
  const closeRef = useRef<HTMLButtonElement>(null);
  const video = item.video!;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={item.caption ?? t("playVideo")} className="fixed inset-0 z-50 flex flex-col bg-ink">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold underline decoration-accent decoration-2 underline-offset-4"
        >
          <VideoProviderIcon provider={video.provider} className="h-4 w-4" />
          {t("openOn", { provider: t(`providers.${video.provider}`) })}
        </a>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={tLightbox("close")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
        >
          <CloseIcon className="h-6 w-6" />
        </button>
      </div>
      <div
        className="flex flex-1 items-center justify-center px-2 pb-6"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <iframe
          src={video.embedUrl!}
          title={item.caption ?? t("playVideo")}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className={cn(
            "rounded-control bg-black",
            video.vertical
              ? "aspect-[9/16] h-[calc(100svh-6rem)] max-w-full"
              : "aspect-video w-full max-w-5xl",
          )}
        />
      </div>
      {item.caption ? <p className="px-4 pb-4 text-center text-sm text-white/75">{item.caption}</p> : null}
    </div>
  );
}
