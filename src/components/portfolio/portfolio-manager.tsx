"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  addPortfolioPhoto,
  addPortfolioVideo,
  deletePortfolioItem,
  setPortfolioThumb,
  updatePortfolioItem,
  type PortfolioError,
} from "@/lib/portfolio/actions";
import type { PortfolioItemView } from "@/lib/data/portfolio";
import { removeUploaded, uploadVariants } from "@/lib/images/upload-variants";
import type { UploadErrorKind } from "@/lib/images/upload-error";
import { PROFILE_MEDIA_BUCKET, portfolioPath } from "@/lib/storage";
import { cn } from "@/lib/cn";
import { VideoProviderIcon } from "./video-provider-icon";
import { TagEditor } from "./tag-editor";

const FEATURED = 12;

/** Správa portfolia: nahrání fotek, videa odkazem, připíchnutí, popisky, mazání. */
export function PortfolioManager({
  userId,
  items,
  mediaEvents,
}: {
  userId: string;
  items: PortfolioItemView[];
  /** Eventy, kde jsem schválený jako média (pro označení) */
  mediaEvents: Array<{ id: string; title: string }>;
}) {
  const t = useTranslations("Portfolio");
  const tUpload = useTranslations("Upload");
  const tPhotos = useTranslations("Photos");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [plate, setPlate] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Array<{ name: string; error: UploadErrorKind | PortfolioError }>>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoCaption, setVideoCaption] = useState("");
  const [videoError, setVideoError] = useState<PortfolioError | null>(null);
  const [error, setError] = useState<PortfolioError | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFiles(files: File[]) {
    setUploadErrors([]);
    setProgress({ done: 0, total: files.length });
    const failed: Array<{ name: string; error: UploadErrorKind | PortfolioError }> = [];
    for (const [i, file] of files.entries()) {
      const itemId = crypto.randomUUID();
      const key = crypto.randomUUID();
      const res = await uploadVariants(file, PROFILE_MEDIA_BUCKET, (size, format) =>
        portfolioPath(userId, itemId, key, size, format),
      );
      if (!res.ok) failed.push({ name: file.name, error: res.error });
      else {
        const saved = await addPortfolioPhoto({ itemId, key, format: res.format, width: res.width, height: res.height });
        if (!saved.ok) {
          await removeUploaded(PROFILE_MEDIA_BUCKET, res.paths);
          failed.push({ name: file.name, error: saved.error });
          if (saved.error === "portfolioLimit" || saved.error === "notCreator") break;
        }
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setUploadErrors(failed);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  function addVideo() {
    setVideoError(null);
    startTransition(async () => {
      const res = await addPortfolioVideo({ url: videoUrl, caption: videoCaption });
      if (res.ok) {
        setVideoUrl("");
        setVideoCaption("");
        router.refresh();
      } else setVideoError(res.error);
    });
  }

  function run(action: () => Promise<{ ok: true } | { ok: false; error: PortfolioError }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }

  const errorText = (e: UploadErrorKind | PortfolioError) =>
    (["heic", "format", "size", "network", "permission", "server"] as const).includes(e as UploadErrorKind)
      ? tUpload(e as UploadErrorKind)
      : t(`errors.${e as PortfolioError}`);

  return (
    <div className="flex flex-col gap-10">
      {/* Nahrání fotek */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-3xl font-extrabold text-ink uppercase">{t("addPhotosTitle")}</h2>
        <p className="-mt-2 text-sm text-ink-soft">{t("addPhotosHint")}</p>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={plate}
            onChange={(e) => setPlate(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
          />
          <span>{tPhotos("plateConfirm")}</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).slice(0, 30);
              if (files.length) void onFiles(files);
            }}
          />
          <Button type="button" disabled={!plate || progress !== null} onClick={() => fileRef.current?.click()}>
            {progress ? t("uploadingProgress", { done: progress.done, total: progress.total }) : t("addPhotos")}
          </Button>
        </div>
        {uploadErrors.length ? (
          <Alert tone="error">
            <p className="font-semibold">{t("uploadFailedSome", { count: uploadErrors.length })}</p>
            <ul className="mt-1 list-disc pl-5">
              {uploadErrors.map((f, i) => (
                <li key={i}>
                  {f.name}: {errorText(f.error)}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}
      </section>

      {/* Video odkazem */}
      <section className="flex flex-col gap-4 border-t border-line pt-8">
        <h2 className="font-display text-3xl font-extrabold text-ink uppercase">{t("addVideoTitle")}</h2>
        <p className="-mt-2 text-sm text-ink-soft">{t("addVideoHint")}</p>
        <Field
          label={t("videoUrlLabel")}
          name="video_url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={500}
          placeholder="https://www.instagram.com/reel/…"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          error={videoError ? t(`errors.${videoError}`) : undefined}
        />
        <Field
          label={t("captionLabel")}
          name="video_caption"
          maxLength={300}
          value={videoCaption}
          onChange={(e) => setVideoCaption(e.target.value)}
        />
        <div>
          <Button type="button" disabled={pending || !videoUrl.trim()} onClick={addVideo}>
            {t("addVideo")}
          </Button>
        </div>
      </section>

      {/* Seznam prací */}
      <section className="flex flex-col gap-4 border-t border-line pt-8">
        <h2 className="font-display text-3xl font-extrabold text-ink uppercase">
          {t("worksTitle")} <span className="text-subtle">({items.length})</span>
        </h2>
        <p className="-mt-2 text-sm text-ink-soft">{t("worksHint", { count: FEATURED })}</p>
        {error ? <Alert tone="error">{t(`errors.${error}`)}</Alert> : null}
        {items.length === 0 ? (
          <p className="rounded-card bg-muted p-6 text-ink-soft">{t("empty")}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => (
              <ManagedItem
                key={item.id}
                item={item}
                userId={userId}
                featured={index < FEATURED}
                mediaEvents={mediaEvents}
                disabled={pending}
                onPin={() => run(() => updatePortfolioItem({ id: item.id, pinned: !item.pinned }))}
                onCaption={(caption) => run(() => updatePortfolioItem({ id: item.id, caption }))}
                onDelete={() => run(() => deletePortfolioItem(item.id))}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ManagedItem({
  item,
  userId,
  featured,
  mediaEvents,
  disabled,
  onPin,
  onCaption,
  onDelete,
}: {
  item: PortfolioItemView;
  userId: string;
  featured: boolean;
  mediaEvents: Array<{ id: string; title: string }>;
  disabled: boolean;
  onPin: () => void;
  onCaption: (caption: string) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("Portfolio");
  const tCommon = useTranslations("Common");
  const tUpload = useTranslations("Upload");
  const router = useRouter();
  const thumbRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState(item.caption ?? "");
  const [confirming, setConfirming] = useState(false);
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbError, setThumbError] = useState<UploadErrorKind | null>(null);

  async function onThumb(file: File) {
    setThumbError(null);
    setThumbBusy(true);
    const key = crypto.randomUUID();
    const res = await uploadVariants(file, PROFILE_MEDIA_BUCKET, (size, format) =>
      portfolioPath(userId, item.id, key, size, format),
    );
    if (!res.ok) setThumbError(res.error);
    else {
      const saved = await setPortfolioThumb({ id: item.id, key, format: res.format });
      if (!saved.ok) {
        await removeUploaded(PROFILE_MEDIA_BUCKET, res.paths);
        setThumbError("server");
      }
      router.refresh();
    }
    setThumbBusy(false);
    if (thumbRef.current) thumbRef.current.value = "";
  }

  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      <div className="relative aspect-[4/3] bg-night">
        {item.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="glow-accent flex h-full w-full items-center justify-center text-white/70">
            {item.video ? <VideoProviderIcon provider={item.video.provider} className="h-12 w-12" /> : null}
          </div>
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold",
              featured ? "bg-accent text-ink" : "bg-black/65 text-white",
            )}
          >
            {featured ? t("badgeProfile") : t("badgeArchive")}
          </span>
          {item.pinned ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink">📌 {t("pinned")}</span>
          ) : null}
        </div>
        {item.video ? (
          <span className="absolute right-2 bottom-2 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
            <VideoProviderIcon provider={item.video.provider} className="h-4 w-4" />
            {t(`providers.${item.video.provider}`)}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <input
          type="text"
          value={caption}
          maxLength={300}
          placeholder={t("captionPlaceholder")}
          aria-label={t("captionLabel")}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => {
            if (caption.trim() !== (item.caption ?? "")) onCaption(caption);
          }}
          className="h-10 w-full rounded-control border border-line px-3 text-sm text-ink placeholder:text-subtle focus:border-ink focus:outline-none"
        />
        {item.tags ? <TagEditor itemId={item.id} tags={item.tags} mediaEvents={mediaEvents} /> : null}
        {thumbError ? <p className="text-sm text-danger">{tUpload(thumbError)}</p> : null}
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{t("deleteQuestion")}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={onDelete}
              className="h-9 rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {t("deleteYes")}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="h-9 px-2 text-sm font-semibold text-ink">
              {tCommon("cancel")}
            </button>
          </div>
        ) : (
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
            <button type="button" disabled={disabled} onClick={onPin} className="text-ink underline underline-offset-4 disabled:opacity-50">
              {item.pinned ? t("unpin") : t("pin")}
            </button>
            {item.video ? (
              <>
                <input
                  ref={thumbRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onThumb(f);
                  }}
                />
                <button
                  type="button"
                  disabled={thumbBusy}
                  onClick={() => thumbRef.current?.click()}
                  className="text-ink underline underline-offset-4 disabled:opacity-50"
                >
                  {thumbBusy ? t("uploading") : item.hasOwnThumb ? t("thumbReplace") : t("thumbAdd")}
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => setConfirming(true)} className="text-danger underline underline-offset-4">
              {t("delete")}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
