"use client";

import { useEffect } from "react";

/**
 * Posune stránku na prvek s daným id, pokud adresa končí #id.
 * Potřeba u sekcí, které se načítají až po zobrazení stránky (Suspense).
 */
export function ScrollToHash({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash === `#${id}`) {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    }
  }, [id]);
  return null;
}
