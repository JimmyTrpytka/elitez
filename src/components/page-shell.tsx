import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Rámec „pracovní“ stránky (účet, garáž, pořadatel…):
 * tmavý pruh s nadpisem (ladí s hlavičkou) a světlý, dobře čitelný obsah.
 */
export function PageShell({
  title,
  subtitle,
  actions,
  children,
  width = "md",
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  width?: "md" | "lg";
}) {
  const container = width === "lg" ? "max-w-6xl" : "max-w-2xl";
  return (
    <div className="flex flex-1 flex-col">
      <div className="glow-accent border-b border-white/10 bg-night print:hidden">
        <div className={cn("mx-auto w-full px-4 pt-10 pb-8 sm:px-6 sm:pt-14 sm:pb-10", container)}>
          <h1 className="reveal font-display text-4xl leading-[0.95] font-extrabold break-words text-white uppercase sm:text-6xl">
            {title}
          </h1>
        </div>
      </div>
      <div className={cn("mx-auto w-full px-4 py-8 sm:px-6 sm:py-10", container)}>
        {subtitle || actions ? (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            {subtitle ? <div className="text-ink-soft">{subtitle}</div> : <span />}
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
