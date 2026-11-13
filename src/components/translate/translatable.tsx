"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { translateContent } from "@/lib/translate/actions";

type Ctx = { texts: Record<string, string> | null };
const TranslationContext = createContext<Ctx>({ texts: null });

/**
 * Skupina přeložitelných textů (auto / profil) s tlačítkem „Přeložit“.
 * Texty se přeloží až na kliknutí a jdou vrátit na originál.
 */
export function Translatable({
  kind,
  id,
  show,
  children,
}: {
  kind: "vehicle" | "profile";
  id: string;
  /** Zobrazit tlačítko? (text není v jazyce čtenáře) */
  show: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("Translate");
  const locale = useLocale();
  const [texts, setTexts] = useState<Record<string, string> | null>(null);
  const [showingTranslation, setShowingTranslation] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    if (showingTranslation) {
      setShowingTranslation(false);
      return;
    }
    if (texts) {
      setShowingTranslation(true);
      return;
    }
    setError(false);
    startTransition(async () => {
      const res = await translateContent(kind, id, locale);
      if (res.ok) {
        setTexts(res.texts);
        setShowingTranslation(true);
      } else setError(true);
    });
  };

  return (
    <TranslationContext.Provider value={{ texts: showingTranslation ? texts : null }}>
      {show ? (
        <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-night-subtle">
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className="inline-flex items-center gap-1.5 font-semibold text-white underline decoration-accent decoration-2 underline-offset-4 disabled:opacity-60"
          >
            <span aria-hidden>🌐</span>
            {pending ? t("translating") : showingTranslation ? t("showOriginal") : t("translate")}
          </button>
          {showingTranslation ? <span>{t("autoNote")}</span> : null}
          {error ? <span className="text-accent">{t("failed")}</span> : null}
        </p>
      ) : null}
      {children}
    </TranslationContext.Provider>
  );
}

/** Text, který se po kliknutí na „Přeložit“ vymění za překlad. */
export function TText({ k, original }: { k: string; original: string }) {
  const { texts } = useContext(TranslationContext);
  return <>{texts?.[k] ?? original}</>;
}
