import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** Společný rámeček pro přihlašovací obrazovky. */
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
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:py-20">
      <Card>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-2 text-ink-soft">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </Card>
      {footer ? (
        <div className="mt-6 text-center text-sm text-ink-soft">{footer}</div>
      ) : null}
    </div>
  );
}

/** Odkaz v textu – černý a podtržený (žlutý text na bílé nepoužíváme). */
export const textLinkClass =
  "font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 hover:decoration-ink";
