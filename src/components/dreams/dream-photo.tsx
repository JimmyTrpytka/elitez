"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { deleteDream, removeDreamPhoto, setDreamPhoto } from "@/lib/dreams/actions";
import { loadImage, resizeImage, supportsWebpEncoding } from "@/lib/images/resize";
import { classifyUploadError, precheckImage, type UploadErrorKind } from "@/lib/images/upload-error";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { DREAM_PHOTOS_BUCKET, dreamPhotoPath, type PhotoSize } from "@/lib/storage";

const SIZES: Array<[PhotoSize, number]> = [
  ["sm", 480],
  ["md", 1200],
  ["lg", 2048],
];

/** Jedna vlastní fotka snu (zmenšená v prohlížeči jako fotky aut). */
export function DreamPhoto({
  dreamId,
  ownerId,
  photoUrl,
  hasOwnPhoto,
}: {
  dreamId: string;
  ownerId: string;
  photoUrl: string | null;
  hasOwnPhoto: boolean;
}) {
  const t = useTranslations("Dreams");
  const tPhotos = useTranslations("Photos");
  const tUpload = useTranslations("Upload");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [plateConfirmed, setPlateConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = uploading || pending;

  async function onFile(file: File) {
    setError(null);
    setUploading(true);
    const supabase = createBrowserSupabase();
    const key = crypto.randomUUID();
    const uploaded: string[] = [];
    const pre = precheckImage(file);
    let bitmap: ImageBitmap | null = null;
    let decodeError: UploadErrorKind | null = pre;
    if (!pre) {
      try {
        bitmap = await loadImage(file);
      } catch (e) {
        decodeError = classifyUploadError(e, file);
      }
    }
    if (!bitmap) {
      setUploading(false);
      setError(tUpload(decodeError ?? "format"));
      return;
    }
    try {
      const useJpeg = !supportsWebpEncoding();
      let format: "webp" | "jpg" = useJpeg ? "jpg" : "webp";
      for (const [size, max] of SIZES) {
        const image = await resizeImage(bitmap, max, { preferJpeg: useJpeg });
        format = image.format;
        const path = dreamPhotoPath(ownerId, dreamId, key, size, image.format);
        const { error: uploadError } = await supabase.storage
          .from(DREAM_PHOTOS_BUCKET)
          .upload(path, image.blob, { contentType: image.contentType });
        if (uploadError) throw uploadError;
        uploaded.push(path);
      }
      const result = await setDreamPhoto({ dreamId, photoKey: key, format });
      if (!result.ok) throw new Error(result.error);
      router.refresh();
    } catch (e) {
      if (uploaded.length) await supabase.storage.from(DREAM_PHOTOS_BUCKET).remove(uploaded);
      setError(tUpload(classifyUploadError(e, file)));
    } finally {
      bitmap.close();
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="aspect-[4/3] w-full max-w-md rounded-card object-cover" />
      ) : (
        <p className="text-ink-soft">{t("photoEmpty")}</p>
      )}
      {!hasOwnPhoto && photoUrl ? <p className="text-sm text-subtle">{t("photoFromLinked")}</p> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={plateConfirmed}
          onChange={(e) => setPlateConfirmed(e.target.checked)}
          className="mt-0.5 h-5 w-5 accent-ink"
        />
        <span>{tPhotos("plateConfirm")}</span>
      </label>

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
        <Button
          type="button"
          disabled={!plateConfirmed || busy}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? t("photoUploading") : hasOwnPhoto ? t("photoReplace") : t("photoAdd")}
        </Button>
        {hasOwnPhoto ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const res = await removeDreamPhoto(dreamId);
                if (!res.ok) setError(t(`errors.${res.error}`));
                router.refresh();
              })
            }
          >
            {t("photoRemove")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Smazání snu: potvrzení přímo na stránce (ne okno prohlížeče – to některé
 * mobilní prohlížeče a aplikace přidané na plochu potichu blokují).
 */
export function DeleteDreamButton({ dreamId }: { dreamId: string }) {
  const t = useTranslations("Dreams");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {confirming ? (
        <>
          <p className="font-semibold text-ink">{t("deleteConfirm")}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteDream(dreamId, locale);
                  if (res && !res.ok) setError(t(`errors.${res.error}`));
                })
              }
              className="h-11 rounded-full bg-danger px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? tCommon("saving") : t("deleteYes")}
            </button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              {tCommon("cancel")}
            </Button>
          </div>
        </>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>
          {t("delete")}
        </Button>
      )}
    </div>
  );
}
