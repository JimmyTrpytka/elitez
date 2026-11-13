"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OrganizerLogo } from "@/components/organizers/organizer-logo";
import { removeOrganizerLogo, setOrganizerLogo } from "@/lib/organizer/profile-actions";
import { loadImage, resizeImage, supportsWebpEncoding } from "@/lib/images/resize";
import { classifyUploadError, precheckImage, type UploadErrorKind } from "@/lib/images/upload-error";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { ORGANIZER_LOGOS_BUCKET, organizerLogoPath, type PhotoSize } from "@/lib/storage";

const SIZES: Array<[PhotoSize, number]> = [
  ["sm", 160],
  ["md", 512],
];

/** Logo pořadatele – zmenší se v prohlížeči do 2 velikostí. */
export function OrganizerLogoUpload({
  organizerId,
  name,
  logoUrl,
}: {
  organizerId: string;
  name: string;
  logoUrl: string | null;
}) {
  const t = useTranslations("OrganizerProfile");
  const tUpload = useTranslations("Upload");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<UploadErrorKind | null>(null);
  const [pending, startTransition] = useTransition();

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
      setError(decodeError ?? "format");
      return;
    }
    try {
      const useJpeg = !supportsWebpEncoding();
      let format: "webp" | "jpg" = useJpeg ? "jpg" : "webp";
      for (const [size, max] of SIZES) {
        const image = await resizeImage(bitmap, max, { preferJpeg: useJpeg });
        format = image.format;
        const path = organizerLogoPath(organizerId, key, size, image.format);
        const { error: e } = await supabase.storage
          .from(ORGANIZER_LOGOS_BUCKET)
          .upload(path, image.blob, { contentType: image.contentType });
        if (e) throw e;
        uploaded.push(path);
      }
      const res = await setOrganizerLogo({ logoKey: key, format });
      if (!res.ok) throw new Error("save");
      router.refresh();
    } catch (e) {
      if (uploaded.length) await supabase.storage.from(ORGANIZER_LOGOS_BUCKET).remove(uploaded);
      setError(classifyUploadError(e, file));
    } finally {
      bitmap.close();
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <OrganizerLogo url={logoUrl} name={name} size={96} />
      <div className="flex flex-col gap-3">
        {error ? <Alert tone="error">{tUpload(error)}</Alert> : null}
        <p className="text-sm text-ink-soft">{t("logoHint")}</p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
          <Button type="button" disabled={uploading || pending} onClick={() => inputRef.current?.click()}>
            {uploading ? t("logoUploading") : logoUrl ? t("logoReplace") : t("logoAdd")}
          </Button>
          {logoUrl ? (
            <Button
              type="button"
              variant="secondary"
              disabled={uploading || pending}
              onClick={() =>
                startTransition(async () => {
                  await removeOrganizerLogo();
                  router.refresh();
                })
              }
            >
              {t("logoRemove")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
