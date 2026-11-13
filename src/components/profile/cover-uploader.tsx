"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { removeProfileCover, setProfileCover } from "@/lib/portfolio/actions";
import { removeUploaded, uploadVariants } from "@/lib/images/upload-variants";
import type { UploadErrorKind } from "@/lib/images/upload-error";
import { PROFILE_MEDIA_BUCKET, profileCoverPath } from "@/lib/storage";

/** Úvodní (cover) fotka profilu – velká fotka v hlavičce. */
export function CoverUploader({ userId, coverUrl }: { userId: string; coverUrl: string | null }) {
  const t = useTranslations("Creator");
  const tUpload = useTranslations("Upload");
  const tPhotos = useTranslations("Photos");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UploadErrorKind | "save" | null>(null);
  const [plate, setPlate] = useState(false);
  const [removing, startRemove] = useTransition();

  async function onFile(file: File) {
    setError(null);
    setBusy(true);
    const key = crypto.randomUUID();
    const res = await uploadVariants(file, PROFILE_MEDIA_BUCKET, (size, format) =>
      profileCoverPath(userId, key, size, format),
    );
    if (!res.ok) {
      setError(res.error);
    } else {
      const saved = await setProfileCover({ key, format: res.format });
      if (saved.ok) router.refresh();
      else {
        await removeUploaded(PROFILE_MEDIA_BUCKET, res.paths);
        setError("save");
      }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">{t("coverHint")}</p>
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="aspect-[21/9] w-full max-w-xl rounded-card object-cover" />
      ) : (
        <div className="glow-accent aspect-[21/9] w-full max-w-xl rounded-card bg-night" aria-hidden />
      )}
      {error ? <Alert tone="error">{error === "save" ? t("saveFailed") : tUpload(error)}</Alert> : null}
      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={plate}
          onChange={(e) => setPlate(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
        />
        <span>{tPhotos("plateConfirm")}</span>
      </label>
      <div className="flex flex-wrap gap-3">
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
        <Button type="button" disabled={busy || !plate} onClick={() => inputRef.current?.click()}>
          {busy ? t("uploading") : coverUrl ? t("coverReplace") : t("coverAdd")}
        </Button>
        {coverUrl ? (
          <Button
            type="button"
            variant="ghost"
            disabled={busy || removing}
            onClick={() =>
              startRemove(async () => {
                await removeProfileCover();
                router.refresh();
              })
            }
          >
            {t("coverRemove")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
