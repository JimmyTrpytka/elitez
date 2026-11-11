"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronIcon, CloseIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type LightboxPhoto = {
  id: string;
  /** Náhled (do mřížky) */
  thumb: string | null;
  /** Velká verze (do prohlížeče) */
  full: string | null;
};

/**
 * Prohlížeč fotek přes celou obrazovku:
 * šipky, klávesy ←/→/Esc, přejetí prstem na mobilu, počítadlo.
 */
export function Lightbox({
  photos,
  index,
  onClose,
  onIndex,
  alt,
}: {
  photos: LightboxPhoto[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
  alt: string;
}) {
  const t = useTranslations("Lightbox");
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const count = photos.length;
  const prev = useCallback(() => onIndex((index - 1 + count) % count), [index, count, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % count), [index, count, onIndex]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  const photo = photos[index];
  const neighbours = [photos[(index + 1) % count], photos[(index - 1 + count) % count]];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("label", { current: index + 1, total: count })}
      className="fixed inset-0 z-50 flex flex-col bg-ink"
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50 && count > 1) (dx < 0 ? next : prev)();
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-semibold tabular-nums">
          {count > 1 ? `${index + 1} / ${count}` : ""}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
        >
          <CloseIcon className="h-6 w-6" />
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center px-2 pb-6 sm:px-16"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {photo?.full ?? photo?.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={photo.id}
            src={photo.full ?? photo.thumb ?? ""}
            alt={`${alt} – ${index + 1}`}
            className="max-h-full max-w-full rounded-control object-contain select-none"
            draggable={false}
          />
        ) : null}

        {count > 1 ? (
          <>
            <NavButton side="left" label={t("previous")} onClick={prev} />
            <NavButton side="right" label={t("next")} onClick={next} />
          </>
        ) : null}
      </div>

      {/* Přednačtení sousedních fotek */}
      <div className="hidden" aria-hidden>
        {neighbours.map((p) =>
          p?.full ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.full} alt="" />
          ) : null,
        )}
      </div>
    </div>
  );
}

function NavButton({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "absolute top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:inline-flex",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <ChevronIcon direction={side === "left" ? "left" : "right"} className="h-6 w-6" />
    </button>
  );
}

/** Mřížka náhledů, která po kliknutí otevře prohlížeč. */
export function PhotoGrid({
  photos,
  alt,
  className,
  imageClassName,
}: {
  photos: LightboxPhoto[];
  alt: string;
  className?: string;
  imageClassName?: string;
}) {
  const t = useTranslations("Lightbox");
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div className={className ?? "grid gap-3 sm:grid-cols-2"}>
        {photos.map((p, i) =>
          p.thumb ? (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpen(i)}
              aria-label={t("open", { n: i + 1 })}
              className="group block cursor-zoom-in overflow-hidden rounded-control focus-visible:outline-offset-4"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.thumb}
                alt=""
                loading="lazy"
                className={
                  imageClassName ??
                  "aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                }
              />
            </button>
          ) : null,
        )}
      </div>
      {open !== null ? (
        <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} alt={alt} />
      ) : null}
    </>
  );
}

/**
 * Velká hlavní fotka nahoře, obsah stránky (children) a galerie dole.
 * Hlavní fotka i galerie otevírají stejný prohlížeč.
 */
export function HeroGallery({
  photos,
  alt,
  galleryTitle,
  children,
}: {
  photos: LightboxPhoto[];
  alt: string;
  galleryTitle: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("Lightbox");
  const [open, setOpen] = useState<number | null>(null);
  const [cover, ...rest] = photos;
  return (
    <>
      {cover?.full ? (
        <button
          type="button"
          onClick={() => setOpen(0)}
          aria-label={t("open", { n: 1 })}
          className="block w-full cursor-zoom-in bg-ink"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover.full} alt={alt} className="mx-auto max-h-[78vh] w-full max-w-7xl object-cover" />
        </button>
      ) : null}
      <div className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
        {children}
        {rest.length ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold">{galleryTitle}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {rest.map((p, i) =>
                p.thumb ? (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setOpen(i + 1)}
                    aria-label={t("open", { n: i + 2 })}
                    className="group block cursor-zoom-in overflow-hidden rounded-control"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.thumb}
                      alt=""
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </button>
                ) : null,
              )}
            </div>
          </section>
        ) : null}
      </div>
      {open !== null ? (
        <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} alt={alt} />
      ) : null}
    </>
  );
}
