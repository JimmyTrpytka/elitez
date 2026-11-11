"use client";

import { useEffect, type RefObject } from "react";

/**
 * Po neúspěšném odeslání formuláře posune stránku k chybě a zaměří ji:
 * - k poli s chybou (data-field="název"), kurzor do něj,
 * - jinak k chybovému rámečku (data-alert-tone="error").
 * Spustí se při každém novém výsledku odeslání (i se stejnou chybou).
 */
export function useScrollToError(
  state: { status: string } | null | undefined,
  field: string | null | undefined,
  formRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (state?.status !== "error") return;
    const root = formRef.current;
    if (!root) return;
    const target =
      (field ? root.querySelector<HTMLElement>(`[data-field="${field}"]`) : null) ??
      root.querySelector<HTMLElement>('[data-alert-tone="error"]');
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = target.matches("input, select, textarea")
      ? target
      : target.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea");
    focusable?.focus({ preventScroll: true });
  }, [state, field, formRef]);
}
