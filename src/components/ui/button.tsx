import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "light" | "outlineDark";
export type ButtonSize = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  // Žlutá plocha, černý text (dobrý kontrast)
  primary: "bg-accent text-ink hover:bg-accent-strong",
  // Černá plocha, bílý text
  secondary: "bg-ink text-white hover:bg-ink-soft",
  // Jen text s jemným podbarvením při najetí
  ghost: "bg-transparent text-ink hover:bg-muted",
  // Na tmavém pozadí: bílé tlačítko s černým textem
  light: "bg-white text-ink hover:bg-white/85",
  // Na tmavém pozadí: průhledné s jemným rámečkem
  outlineDark: "border border-white/25 bg-white/5 text-white backdrop-blur hover:bg-white/10",
};

const sizes: Record<ButtonSize, string> = {
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

/** Třídy tlačítka – dají se použít i pro odkazy, které mají vypadat jako tlačítko. */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}
