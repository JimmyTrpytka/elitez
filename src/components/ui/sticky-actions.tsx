import type { ReactNode } from "react";

/**
 * Lišta s tlačítkem Uložit přilepená ke spodku obrazovky (dlouhé formuláře):
 * tlačítko je pořád po ruce a hned vedle se ukáže „Uloženo ✓“.
 */
export function StickyActions({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {children}
        {note ? (
          <p role="status" className="text-sm font-semibold text-ink">
            {note}
          </p>
        ) : null}
      </div>
    </div>
  );
}
