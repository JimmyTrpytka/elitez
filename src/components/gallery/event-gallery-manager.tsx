"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { addEventPhoto, deleteEventPhoto, setEventWorkHidden, type GalleryError } from "@/lib/gallery/actions";
import type { PortfolioItemView } from "@/lib/data/portfolio";
import { removeUploaded, uploadVariants } from "@/lib/images/upload-variants";
import type { UploadErrorKind } from "@/lib/images/upload-error";
import { EVENT_GALLERY_BUCKET, eventGalleryPath } from "@/lib/storage";
import { cn } from "@/lib/cn";

/** Karta „Galerie“ ve správě eventu: nahrát fotky, smazat, skrýt práce médií. */
export function EventGalleryManager({
  eventId,
  organizer,
  media,
}: {
  eventId: string;
  organizer: PortfolioItemView[];
  media: PortfolioItemView[];
}) {
  const t = useTranslations("Gallery");
  const tUpload = useTranslations("Upload");
  const tPhotos = useTranslations("Photos");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [plate, setPlate] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<Array<{ name: string; error: UploadErrorKind | GalleryError }>>([]);
  const [error, setError] = useState<GalleryError | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFiles(files: File[]) {
    setFailed([]);
    setProgress({ done: 0, total: files.length });
    const errors: Array<{ name: string; error: UploadErrorKind | GalleryError }> = [];
    for (const [i, file] of files.entries()) {
      const photoId = crypto.randomUUID();
      const key = crypto.randomUUID();
      const res = await uploadVariants(file, EVENT_GALLERY_BUCKET, (size, format) =>
        eventGalleryPath(eventId, photoId, key, size, format),
      );
      if (!res.ok) errors.push({ name: file.name, error: res.error });
      else {
        const saved = await addEventPhoto({ eventId, photoId, key, format: res.format, width: res.width, height: res.height });
        if (!saved.ok) {
          await removeUploaded(EVENT_GALLERY_BUCKET, res.paths);
          errors.push({ name: file.name, error: saved.error });
          if (saved.error === "galleryLimit") break;
        }
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setFailed(errors);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  const run = (action: () => ReturnType<typeof deleteEventPhoto>) => {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
      setConfirmId(null);
      router.refresh();
    });
  };

  const errorText = (e: UploadErrorKind | GalleryError) =>
    e === "notAllowed" || e === "galleryLimit" || e === "generic" ? t(`errors.${e}`) : tUpload(e);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-soft">{t("managerIntro")}</p>
      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={plate}
          onChange={(e) => setPlate(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
        />
        <span>{tPhotos("plateConfirm")}</span>
      </label>
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).slice(0, 50);
            if (files.length) void onFiles(files);
          }}
        />
        <Button type="button" disabled={!plate || progress !== null} onClick={() => fileRef.current?.click()}>
          {progress ? t("uploadingProgress", { done: progress.done, total: progress.total }) : t("addPhotos")}
        </Button>
      </div>
      {failed.length ? (
        <Alert tone="error">
          <ul className="list-disc pl-5">
            {failed.map((f, i) => (
              <li key={i}>
                {f.name}: {errorText(f.error)}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {error ? <Alert tone="error">{t(`errors.${error}`)}</Alert> : null}

      {organizer.length ? (
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">{t("organizerPhotos", { count: organizer.length })}</p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {organizer.map((p) => (
              <li key={p.id} className="flex flex-col gap-1">
                {p.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbUrl} alt="" loading="lazy" className="aspect-square w-full rounded-control object-cover" />
                ) : (
                  <div className="aspect-square rounded-control bg-muted" />
                )}
                {confirmId === p.id ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deleteEventPhoto(p.id))}
                    className="text-xs font-semibold text-danger underline underline-offset-4"
                  >
                    {t("deleteYes")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(p.id)}
                    className="text-xs font-semibold text-ink underline underline-offset-4"
                  >
                    {t("delete")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {media.length ? (
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">{t("mediaWorks", { count: media.length })}</p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {media.map((m) => (
              <li key={m.id} className="flex flex-col gap-1">
                {m.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.thumbUrl}
                    alt=""
                    loading="lazy"
                    className={cn("aspect-square w-full rounded-control object-cover", m.hidden && "opacity-40 grayscale")}
                  />
                ) : (
                  <div className="aspect-square rounded-control bg-muted" />
                )}
                {m.credit ? (
                  <Link href={`/u/${m.credit.username}`} className="truncate text-xs text-ink-soft underline underline-offset-2">
                    {m.credit.name}
                  </Link>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setEventWorkHidden(m.id, !m.hidden))}
                  className="text-left text-xs font-semibold text-ink underline underline-offset-4 disabled:opacity-50"
                >
                  {m.hidden ? t("show") : t("hide")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
