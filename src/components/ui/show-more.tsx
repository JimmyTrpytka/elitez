"use client";

import { Children, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Mřížka, která na začátku ukáže jen prvních `initial` položek
 * a tlačítko „Ukázat další (n)“. Položky se vykreslí na serveru.
 */
export function ShowMoreGrid({
  children,
  initial,
  className,
  moreLabel,
  lessLabel,
}: {
  children: React.ReactNode;
  initial: number;
  className?: string;
  /** Text tlačítka, `#` se nahradí počtem skrytých */
  moreLabel: string;
  lessLabel: string;
}) {
  const items = Children.toArray(children);
  const [open, setOpen] = useState(false);
  const hidden = items.length - initial;
  const visible = open || hidden <= 0 ? items : items.slice(0, initial);

  return (
    <>
      <div className={className}>{visible}</div>
      {hidden > 0 ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "mt-4 inline-flex min-h-11 items-center rounded-full border border-white/20 px-5 text-sm font-semibold text-white transition-colors hover:border-accent",
          )}
        >
          {open ? `${lessLabel} ↑` : `${moreLabel.replace("#", String(hidden))} ↓`}
        </button>
      ) : null}
    </>
  );
}
