import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Tmavá „výkladní“ sekce s jemnou žlutou září (SPEC 11). */
export function DarkSection({
  children,
  className,
  glow = true,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  as?: "section" | "div" | "header";
}) {
  return (
    <Tag className={cn("relative bg-night text-night-text", glow && "glow-accent", className)}>
      {children}
    </Tag>
  );
}

/** Malý nadpisek VERZÁLKAMI se žlutou tečkou. */
export function Eyebrow({
  children,
  dark = false,
  className,
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-xs font-semibold tracking-[0.22em] uppercase sm:text-sm",
        dark ? "text-night-subtle" : "text-subtle",
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
      {children}
    </p>
  );
}

/** Velký nadpis úzkým tučným písmem (verzálky). */
export function DisplayHeading({
  children,
  as: Tag = "h2",
  size = "lg",
  className,
}: {
  children: ReactNode;
  as?: "h1" | "h2" | "h3";
  size?: "xl" | "lg" | "md";
  className?: string;
}) {
  const sizes = {
    xl: "text-[3.1rem] leading-[0.9] sm:text-7xl lg:text-[7.5rem]",
    lg: "text-5xl leading-[0.92] sm:text-7xl",
    md: "text-3xl leading-[0.95] sm:text-5xl",
  };
  return (
    <Tag
      className={cn(
        "font-display font-extrabold tracking-[-0.01em] uppercase",
        sizes[size],
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Zvýrazněné slovo v nadpisu: na tmavém žlutě, na světlém „fixkou“. */
export function Highlight({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return dark ? <span className="text-accent">{children}</span> : <span className="marker">{children}</span>;
}
