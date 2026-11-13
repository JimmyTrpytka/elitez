"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { loadImage, resizeImage, supportsWebpEncoding } from "@/lib/images/resize";
import { classifyUploadError, precheckImage, type UploadErrorKind } from "@/lib/images/upload-error";
import { removeEventCover, setEventCover } from "@/lib/organizer/actions";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { EVENT_IMAGES_BUCKET, eventImagePath, type PhotoSize } from "@/lib/storage";

const SIZES: Array<[PhotoSize, number]> = [
  ["sm", 480],
  ["md", 1200],
  ["lg", 2048],
];

export function EventCoverUploader({
  eventId,
  coverUrl,
}: {
  eventId: string;
  coverUrl: string | null;
}) {
  const t = useTranslations("Organizer");
  const tUpload = useTranslations("Upload");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<UploadErrorKind | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setFailed(null);
    const pre = precheckImage(file);
    if (pre) {
      setFailed(pre);
      setBusy(false);
      return;
    }
    const supabase = createBrowserSupabase();
    const imageId = crypto.randomUUID();
    const prefix = `${eventId}/${imageId}`;
    const uploaded: string[] = [];
    try {
      const bitmap = await loadImage(file);
      const useJpeg = !supportsWebpEncoding();
      let format: "webp" | "jpg" = useJpeg ? "jpg" : "webp";
      for (const [size, max] of SIZES) {
        const image = await resizeImage(bitmap, max, { preferJpeg: useJpeg });
        format = image.format;
        const path = eventImagePath(prefix, size, image.format);
        const { error } = await supabase.storage
          .from(EVENT_IMAGES_BUCKET)
          .upload(path, image.blob, { contentType: image.contentType });
        if (error) throw error;
        uploaded.push(path);
      }
      bitmap.close();
      const result = await setEventCover({ eventId, imageId, format });
      if (!result.ok) throw new Error(result.error);
      router.refresh();
    } catch (e) {
      if (uploaded.length) await supabase.storage.from(EVENT_IMAGES_BUCKET).remove(uploaded);
      setFailed(classifyUploadError(e, file));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onRemove() {
    setBusy(true);
    const result = await removeEventCover(eventId);
    if (!result.ok) setFailed("server");
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-[16/9] w-full overflow-hidden rounded-control bg-muted">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-subtle">
            {t("coverEmpty")}
          </div>
        )}
      </div>
      {failed ? <Alert tone="error">{tUpload(failed)}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? t("coverUploading") : coverUrl ? t("coverChange") : t("coverUpload")}
        </Button>
        {coverUrl ? (
          <Button variant="ghost" disabled={busy} onClick={onRemove}>
            {t("coverRemove")}
          </Button>
        ) : null}
      </div>
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
    </div>
  );
}
