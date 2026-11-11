"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Lightbox } from "@/components/lightbox";
import { Button } from "@/components/ui/button";
import {
  addVehiclePhoto,
  deleteVehiclePhoto,
  reorderVehiclePhotos,
} from "@/lib/garage/actions";
import type { PhotoView } from "@/lib/data/vehicles";
import { loadImage, resizeImage, supportsWebpEncoding } from "@/lib/images/resize";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { VEHICLE_PHOTOS_BUCKET, vehiclePhotoPath, type PhotoSize } from "@/lib/storage";
import { LIMITS } from "@/lib/validation";

/** Velikosti, do kterých se každá fotka zmenší (delší strana v px). */
const SIZES: Array<[PhotoSize, number]> = [
  ["sm", 480],
  ["md", 1200],
  ["lg", 2048],
];

export function PhotoManager({
  vehicleId,
  photos,
  title,
}: {
  vehicleId: string;
  photos: PhotoView[];
  title: string;
}) {
  const t = useTranslations("Photos");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [plateConfirmed, setPlateConfirmed] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [viewing, setViewing] = useState<number | null>(null);

  const remaining = LIMITS.photosPerVehicle - photos.length;
  const busy = progress !== null || pending;

  async function uploadOne(file: File, useJpeg: boolean) {
    const supabase = createBrowserSupabase();
    const photoId = crypto.randomUUID();
    const bitmap = await loadImage(file);
    const uploaded: string[] = [];
    let largest = { width: bitmap.width, height: bitmap.height };
    let format: "webp" | "jpg" = useJpeg ? "jpg" : "webp";
    try {
      for (const [size, max] of SIZES) {
        const image = await resizeImage(bitmap, max, { preferJpeg: useJpeg });
        format = image.format;
        const path = vehiclePhotoPath(vehicleId, photoId, size, image.format);
        const { error: uploadError } = await supabase.storage
          .from(VEHICLE_PHOTOS_BUCKET)
          .upload(path, image.blob, { contentType: image.contentType });
        if (uploadError) throw uploadError;
        uploaded.push(path);
        largest = { width: image.width, height: image.height };
      }
      const result = await addVehiclePhoto({
        vehicleId,
        photoId,
        format,
        width: largest.width,
        height: largest.height,
      });
      if (!result.ok) throw new Error(result.error);
    } catch (e) {
      // Uklidit napůl nahrané soubory
      if (uploaded.length) await supabase.storage.from(VEHICLE_PHOTOS_BUCKET).remove(uploaded);
      throw e;
    } finally {
      bitmap.close();
    }
  }

  async function onFiles(list: FileList) {
    setError(null);
    const files = Array.from(list).slice(0, Math.max(0, remaining));
    if (files.length === 0) {
      setError(t("limitReached", { max: LIMITS.photosPerVehicle }));
      return;
    }
    const useJpeg = !supportsWebpEncoding();
    setProgress({ done: 0, total: files.length });
    let failed = 0;
    for (const [i, file] of files.entries()) {
      try {
        await uploadOne(file, useJpeg);
      } catch (e) {
        failed += 1;
        if (e instanceof Error && e.message === "photoLimit") break;
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
    if (failed) setError(t("uploadFailed", { count: failed }));
    if (list.length > files.length) setError(t("limitReached", { max: LIMITS.photosPerVehicle }));
    router.refresh();
  }

  function move(index: number, delta: number) {
    const ids = photos.map((p) => p.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    startTransition(async () => {
      await reorderVehiclePhotos(vehicleId, ids);
      router.refresh();
    });
  }

  function makeCover(index: number) {
    const ids = photos.map((p) => p.id);
    const [picked] = ids.splice(index, 1);
    startTransition(async () => {
      await reorderVehiclePhotos(vehicleId, [picked, ...ids]);
      router.refresh();
    });
  }

  function remove(photoId: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      const result = await deleteVehiclePhoto(photoId);
      if (!result.ok) setError(t("actionFailed"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className="overflow-hidden rounded-control bg-muted">
              <div className="relative aspect-[4/3]">
                {photo.urls.sm ? (
                  <button
                    type="button"
                    onClick={() => setViewing(index)}
                    aria-label={t("view", { n: index + 1 })}
                    className="block h-full w-full cursor-zoom-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.urls.sm} alt="" className="h-full w-full object-cover" />
                  </button>
                ) : null}
                {index === 0 ? (
                  <span className="absolute top-2 left-2 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-ink">
                    {t("cover")}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-1 p-2">
                <IconButton label={t("moveLeft")} disabled={busy || index === 0} onClick={() => move(index, -1)}>
                  ←
                </IconButton>
                <IconButton
                  label={t("moveRight")}
                  disabled={busy || index === photos.length - 1}
                  onClick={() => move(index, 1)}
                >
                  →
                </IconButton>
                {index !== 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => makeCover(index)}
                    className="rounded-full px-2.5 py-1 text-xs font-semibold text-ink hover:bg-surface disabled:opacity-40"
                  >
                    {t("makeCover")}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(photo.id)}
                  className="ml-auto rounded-full px-2.5 py-1 text-xs font-semibold text-danger hover:bg-surface disabled:opacity-40"
                >
                  {t("delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft">{t("empty")}</p>
      )}

      {error ? <Alert tone="error">{error}</Alert> : null}

      {remaining > 0 ? (
        <div className="flex flex-col gap-3 rounded-control border border-line p-4">
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={plateConfirmed}
              onChange={(e) => setPlateConfirmed(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
            />
            <span>{t("plateConfirm")}</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              disabled={!plateConfirmed || busy}
              onClick={() => inputRef.current?.click()}
            >
              {progress
                ? t("uploading", { done: progress.done, total: progress.total })
                : t("upload")}
            </Button>
            <span className="text-sm text-subtle">
              {t("remaining", { count: remaining, max: LIMITS.photosPerVehicle })}
            </span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void onFiles(e.target.files);
            }}
          />
        </div>
      ) : (
        <p className="text-sm text-subtle">{t("limitReached", { max: LIMITS.photosPerVehicle })}</p>
      )}

      {viewing !== null ? (
        <Lightbox
          photos={photos.map((p) => ({ id: p.id, thumb: p.urls.sm ?? null, full: p.urls.lg ?? p.urls.sm ?? null }))}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          alt={title}
        />
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="h-8 w-8 rounded-full text-sm font-semibold text-ink hover:bg-surface disabled:opacity-30"
    >
      {children}
    </button>
  );
}
