"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { toggleTurbo, type SocialError } from "@/lib/social/actions";
import { cn } from "@/lib/cn";
import { TurboIcon, formatCount } from "./turbo-icon";

export type TurboTarget = { photoId: string } | { profileId: string } | { portfolioItemId: string };
export type TurboState = { given: boolean; count: number };
/** active = může dát turbo, guest = nepřihlášený, own = vlastní obsah */
export type TurboMode = "active" | "guest" | "own";

const variants = {
  /** přes fotku */
  overlay: "bg-black/55 text-white ring-1 ring-white/15 backdrop-blur-md hover:bg-black/70",
  /** na tmavé stránce */
  dark: "bg-white/5 text-white ring-1 ring-white/15 hover:bg-white/10",
} as const;

/**
 * Tlačítko turba (řízené zvenku – stav drží rodič, aby se shodoval
 * v mřížce i v prohlížeči fotek). Změna se projeví hned, server ji potvrdí.
 */
export function TurboButton({
  target,
  state,
  onState,
  mode,
  variant = "dark",
  size = "md",
  className,
}: {
  target: TurboTarget;
  state: TurboState;
  onState: (s: TurboState) => void;
  mode: TurboMode;
  variant?: keyof typeof variants;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const t = useTranslations("Social");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [spin, setSpin] = useState(0);
  const [error, setError] = useState<SocialError | null>(null);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(id);
  }, [error]);

  const sizes = {
    sm: "h-9 gap-1.5 px-3 text-sm",
    md: "h-11 gap-2 px-4 text-base",
    lg: "h-12 gap-2.5 px-5 text-lg",
  }[size];
  const icon = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-7 w-7" : "h-6 w-6";
  const count = formatCount(state.count, locale);
  const base = cn(
    "relative inline-flex shrink-0 items-center rounded-full font-semibold tabular-nums transition-colors",
    sizes,
    variants[variant],
    className,
  );

  if (mode === "guest") {
    return (
      <Link href="/login" className={base} title={t("guestHint")} aria-label={`${t("turboCount", { count: state.count })} – ${t("guestHint")}`}>
        <TurboIcon className={icon} />
        <span>{count}</span>
      </Link>
    );
  }

  if (mode === "own") {
    return (
      <span className={cn(base, "cursor-default hover:bg-transparent")} title={t("ownHint")}>
        <TurboIcon className={cn(icon, state.count > 0 && "text-accent")} />
        <span>{count}</span>
        <span className="sr-only">{t("turboCount", { count: state.count })}</span>
      </span>
    );
  }

  const onClick = () => {
    const previous = state;
    const next = { given: !state.given, count: Math.max(0, state.count + (state.given ? -1 : 1)) };
    onState(next);
    if (next.given) setSpin((n) => n + 1);
    setError(null);
    startTransition(async () => {
      const res = await toggleTurbo(target);
      if (res.ok) onState({ given: res.given, count: res.total });
      else {
        onState(previous);
        setError(res.error);
      }
    });
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={state.given}
        aria-label={`${state.given ? t("remove") : t("give")} (${t("turboCount", { count: state.count })})`}
        title={state.given ? t("remove") : t("give")}
        className={cn(
          base,
          "cursor-pointer disabled:cursor-wait",
          state.given && "bg-accent/15 text-accent ring-accent/60 hover:bg-accent/25",
        )}
      >
        <span key={spin} className={cn("inline-flex", spin > 0 && state.given && "turbo-spin")}>
          <TurboIcon className={icon} filled={state.given} />
        </span>
        <span>{count}</span>
      </button>
      {error ? (
        <span
          role="status"
          className="absolute top-full right-0 z-20 mt-2 w-56 rounded-control bg-white p-3 text-left text-sm font-normal text-ink shadow-xl"
        >
          {t(`errors.${error}`)}
        </span>
      ) : null}
    </span>
  );
}

/** Samostatné turbo (drží si stav samo) – např. turbo pro celou garáž. */
export function TurboToggle({
  initial,
  ...props
}: Omit<Parameters<typeof TurboButton>[0], "state" | "onState"> & { initial: TurboState }) {
  const [state, setState] = useState(initial);
  return <TurboButton {...props} state={state} onState={setState} />;
}
