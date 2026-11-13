"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Přilepená lišta „Přihlásit auto“ dole na mobilu. Ukazuje se jen, dokud
 * je box Registrace ještě pod obrazovkou (jakmile ho člověk vidí nebo ho
 * přejede, lišta zmizí a nepřekáží).
 */
export function StickyRegisterBar({
  targetId,
  title,
  detail,
  children,
}: {
  targetId: string;
  title: string;
  detail?: string | null;
  children: ReactNode;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      setShow(!entry.isIntersecting && entry.boundingClientRect.top > 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [targetId]);

  return (
    <div
      aria-hidden={!show}
      className={
        "fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-night/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 sm:hidden " +
        (show ? "translate-y-0" : "pointer-events-none translate-y-full")
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-tight font-extrabold text-white uppercase">{title}</p>
          {detail ? <p className="truncate text-xs text-night-subtle">{detail}</p> : null}
        </div>
        <div className="shrink-0" inert={!show}>
          {children}
        </div>
      </div>
    </div>
  );
}
