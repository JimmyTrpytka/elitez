"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Sdílet: na telefonu otevře systémovou nabídku (WhatsApp, Messenger…),
 * jinde zkopíruje odkaz do schránky.
 */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const t = useTranslations("Share");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(id);
  }, [copied]);

  async function share() {
    const url = window.location.href.split("#")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title: `${title} · ELITEZ`, url });
        return;
      } catch (e) {
        // Zrušení sdílení uživatelem není chyba
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt(t("copyPrompt"), url);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={cn(buttonClasses("outlineDark"), "cursor-pointer gap-2", className)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
        <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
        <path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" />
      </svg>
      <span aria-live="polite">{copied ? t("copied") : t("share")}</span>
    </button>
  );
}
