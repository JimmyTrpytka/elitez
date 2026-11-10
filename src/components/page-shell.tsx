import type { ReactNode } from "react";

/** Rámec stránky s nadpisem (pro účet, garáž apod.). */
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
  return (
    <div
      className={
        width === "lg"
          ? "mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14"
          : "mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14"
      }
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
          {subtitle ? <div className="mt-2 text-ink-soft">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
