"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TurboIcon } from "@/components/social/turbo-icon";
import { cn } from "@/lib/cn";

/** Ukázka turba na landing page – nic neukládá, jen ukáže, jak to funguje. */
export function TurboDemo() {
  const t = useTranslations("Welcome");
  const [count, setCount] = useState(127);
  const [spin, setSpin] = useState(0);
  const [given, setGiven] = useState(false);

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => {
          setSpin((s) => s + 1);
          setGiven((g) => !g);
          setCount((c) => (given ? c - 1 : c + 1));
        }}
        aria-pressed={given}
        className={cn(
          "inline-flex h-20 items-center gap-4 rounded-full px-8 font-display text-4xl font-extrabold transition-colors",
          given ? "bg-accent text-ink" : "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15",
        )}
      >
        <span key={spin} className={spin ? "turbo-spin" : undefined}>
          <TurboIcon className="h-11 w-11" filled={given} />
        </span>
        <span className="tabular-nums">{count}</span>
      </button>
      <p className="text-sm text-night-subtle">{given ? t("turboDemoDone") : t("turboDemoHint")}</p>
    </div>
  );
}
