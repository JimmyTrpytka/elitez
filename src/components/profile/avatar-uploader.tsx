"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { loadImage, resizeImage } from "@/lib/images/resize";
import { removeAvatar, setAvatar } from "@/lib/profile/actions";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { AVATARS_BUCKET } from "@/lib/storage";

export function AvatarUploader({
  userId,
  name,
  avatarUrl,
}: {
  userId: string;
  name: string;
  avatarUrl: string | null;
}) {
  const t = useTranslations("Profile");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    setFailed(false);
    try {
      const bitmap = await loadImage(file);
      const image = await resizeImage(bitmap, 512, { square: true });
      bitmap.close();
      const path = `${userId}/avatar-${Date.now()}.${image.format}`;
      const supabase = createBrowserSupabase();
      const { error } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, image.blob, { contentType: image.contentType });
      if (error) throw error;
      const result = await setAvatar(path);
      if (!result.ok) throw new Error("setAvatar failed");
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onRemove() {
    setBusy(true);
    setFailed(false);
    const result = await removeAvatar();
    if (!result.ok) setFailed(true);
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Avatar url={avatarUrl} name={name} size={80} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? t("avatarUploading") : t("avatarChange")}
          </Button>
          {avatarUrl ? (
            <Button variant="ghost" disabled={busy} onClick={onRemove}>
              {t("avatarRemove")}
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
      {failed ? <Alert tone="error">{t("avatarFailed")}</Alert> : null}
    </div>
  );
}
