import { cn } from "@/lib/cn";

/** Provizorní logo (textové). Skutečné logo se vymění po dodání. */
export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 font-display text-[1.35rem] leading-none font-extrabold tracking-[0.16em] sm:text-2xl",
        dark ? "text-white" : "text-ink",
      )}
    >
      <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_12px_rgb(255_214_10/0.8)]" />
      ELITEZ
    </span>
  );
}
