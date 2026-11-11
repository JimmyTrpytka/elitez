"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Událost prohlížeče Chrome/Android „aplikaci jde nainstalovat“. */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "elitez-install-hint-dismissed";

/**
 * „Přidej si ELITEZ na plochu“ – nenápadná karta. Na Androidu/Chrome tlačítko
 * Nainstalovat, na iPhonu návod (Sdílet → Přidat na plochu). Nezobrazí se,
 * když už aplikace běží z plochy nebo ji uživatel skryl.
 */
export function InstallHint() {
  const t = useTranslations("Install");
  const [mode, setMode] = useState<"none" | "prompt" | "ios">("none");
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // soukromé okno apod. – nevadí
    }
    if (standalone || dismissed) return;

    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIos) timer = setTimeout(() => setMode("ios"), 0);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
      setMode("prompt");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // nevadí
    }
    setMode("none");
  }

  if (mode === "none") return null;

  return (
    <section className="flex flex-col gap-4 rounded-card bg-night p-6 text-white sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-display text-2xl leading-none font-extrabold uppercase">{t("title")}</p>
        <p className="mt-2 text-sm text-white/70">{mode === "ios" ? t("iosText") : t("text")}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {mode === "prompt" && prompt ? (
          <Button
            type="button"
            onClick={async () => {
              await prompt.prompt();
              await prompt.userChoice;
              setPrompt(null);
              setMode("none");
            }}
          >
            {t("install")}
          </Button>
        ) : null}
        <Button type="button" variant="outlineDark" onClick={dismiss}>
          {t("dismiss")}
        </Button>
      </div>
    </section>
  );
}
