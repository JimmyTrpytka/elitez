import type { ReactNode } from "react";

/** Odznak – žlutá plocha s černým textem. */
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-semibold tracking-wide text-ink uppercase">
      {children}
    </span>
  );
}
