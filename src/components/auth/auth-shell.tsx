import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** Přihlašovací obrazovky: tmavé pozadí se září a světlá karta s formulářem. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="glow-accent flex flex-1 flex-col bg-night">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:py-20">
        <Card className="reveal border-0 shadow-[0_30px_80px_-30px_rgb(255_214_10/0.35)]">
          <h1 className="font-display text-4xl leading-none font-extrabold text-ink uppercase">
            {title}
          </h1>
          {subtitle ? <p className="mt-3 text-ink-soft">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </Card>
        {footer ? (
          <div className="mt-6 text-center text-sm text-white/70 [&_a]:text-white [&_a]:decoration-accent">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Odkaz v textu – černý a podtržený (žlutý text na bílé nepoužíváme). */
export const textLinkClass =
  "font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 hover:decoration-ink";
