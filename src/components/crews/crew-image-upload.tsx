"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { setCrewImage } from "@/lib/crews/actions";
import { loadImage, resizeImage, supportsWebpEncoding } from "@/lib/images/resize";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { CREW_IMAGES_BUCKET, crewImagePath, type PhotoSize } from "@/lib/storage";

const SIZES: Record<"logo" | "cover", Array<[PhotoSize, number]>> = {
  logo: [
    ["sm", 160],
    ["md", 512],
  ],
  cover: [
    ["sm", 480],
    ["md", 1200],
    ["lg", 2048],
  ],
};

/** Nahrání loga nebo úvodní fotky crew (zmenšení v prohlížeči). */
export function CrewImageUpload({
  crewId,
  kind,
  url,
}: {
  crewId: string;
  kind: "logo" | "cover";
  url: string | null;
}) {
  const t = useTranslations("Crews");
  const tPhotos = useTranslations("Photos");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [plate, setPlate] = useState(kind === "logo");

  async function onFile(file: File) {
    setError(false);
    setBusy(true);
    const supabase = createBrowserSupabase();
    const key = crypto.randomUUID();
    const uploaded: string[] = [];
    const bitmap = await loadImage(file).catch(() => null);
    if (!bitmap) {
      setBusy(false);
      setError(true);
      return;
    }
    try {
      const useJpeg = !supportsWebpEncoding();
      let format: "webp" | "jpg" = useJpeg ? "jpg" : "webp";
      for (const [size, max] of SIZES[kind]) {
        const image = await resizeImage(bitmap, max, { preferJpeg: useJpeg });
        format = image.format;
        const path = crewImagePath(crewId, key, size, image.format);
        const { error: e } = await supabase.storage
          .from(CREW_IMAGES_BUCKET)
          .upload(path, image.blob, { contentType: image.contentType });
        if (e) throw e;
        uploaded.push(path);
      }
      const res = await setCrewImage({ crewId, kind, key, format });
      if (!res.ok) throw new Error("save");
      router.refresh();
    } catch {
      if (uploaded.length) await supabase.storage.from(CREW_IMAGES_BUCKET).remove(uploaded);
      setError(true);
    } finally {
      bitmap.close();
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className={kind === "logo" ? "h-24 w-24 rounded-full bg-white object-contain" : "aspect-[21/9] w-full max-w-xl rounded-card object-cover"}
        />
      ) : null}
      {error ? <Alert tone="error">{t("imageFailed")}</Alert> : null}
      {kind === "cover" ? (
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" checked={plate} onChange={(e) => setPlate(e.target.checked)} className="mt-0.5 h-5 w-5 accent-ink" />
          <span>{tPhotos("plateConfirm")}</span>
        </label>
      ) : null}
      <div>
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
          {busy ? t("uploading") : url ? t("imageReplace") : t("imageAdd")}
        </Button>
      </div>
    </div>
  );
}
