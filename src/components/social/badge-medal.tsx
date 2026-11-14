import { cn } from "@/lib/cn";
import { TurboIcon } from "./turbo-icon";

export type Rarity = "common" | "rare" | "epic" | "legendary";

/** Barva podle vzácnosti (běžný / vzácný / epický / legendární). */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#c7c7cc",
  rare: "#4ea8ff",
  epic: "#b07cff",
  legendary: "#ffd60a",
};

const TURBO_METAL: Record<string, string> = {
  turbo_bronze: "#d08a4f",
  turbo_silver: "#d9dee5",
  turbo_gold: "#ffd60a",
};

function Glyph({ icon, className }: { icon: string; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (icon) {
    case "turbo_bronze":
    case "turbo_silver":
    case "turbo_gold":
      return <TurboIcon className={className} filled />;
    case "beta":
      // klíč (stavíme klub) – odznak Beta tester
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 0 0-5.2 5.2L4 17l3 3 5.5-5.5a4 4 0 0 0 5.2-5.2l-2.4 2.4-2.6-.6-.6-2.6 2.6-2.2Z" fill="currentColor" fillOpacity={0.2} />
        </svg>
      );
    case "crown":
      return (
        <svg {...common}>
          <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8Z" fill="currentColor" fillOpacity={0.2} />
          <path d="M5 21h14" />
        </svg>
      );
    case "fan":
      return (
        <svg {...common}>
          <path
            d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z"
            fill="currentColor"
            fillOpacity={0.2}
          />
        </svg>
      );
    case "flame":
      return (
        <svg {...common}>
          <path
            d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.3 3.4-8.3.9 1.6 1.6 2.5 2.8 3.2.4-2.6 1.6-4.6 3.4-6.2.2 3 3.4 6 3.4 10.6C18.5 18.4 15.9 21 12 21Z"
            fill="currentColor"
            fillOpacity={0.2}
          />
          <path d="M12 21c-1.6 0-2.7-1.1-2.7-2.6 0-1.6 1.3-2.4 2.7-4.2 1.4 1.8 2.7 2.6 2.7 4.2 0 1.5-1.1 2.6-2.7 2.6Z" />
        </svg>
      );
    case "compass":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M15.5 8.5l-2 5-5 2 2-5 5-2Z" fill="currentColor" fillOpacity={0.3} />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" fill="currentColor" fillOpacity={0.2} />
          <path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8 20h8" />
        </svg>
      );
    case "star":
    default:
      return (
        <svg {...common}>
          <path
            d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z"
            fill="currentColor"
            fillOpacity={0.2}
          />
        </svg>
      );
  }
}

/**
 * Medaile odznaku: šestiúhelník s barvou vzácnosti a ikonou.
 * `locked` = ještě nezískaný (šedý).
 */
export function BadgeMedal({
  icon,
  rarity,
  size = 72,
  locked = false,
  className,
}: {
  icon: string;
  rarity: Rarity;
  size?: number;
  locked?: boolean;
  className?: string;
}) {
  const ring = locked ? "#3a3a3c" : RARITY_COLOR[rarity];
  const glyph = locked ? "#636366" : (TURBO_METAL[icon] ?? RARITY_COLOR[rarity]);
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{
        width: size,
        height: size,
        filter: locked ? undefined : `drop-shadow(0 0 ${rarity === "legendary" ? 14 : 8}px ${ring}55)`,
      }}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <path
          d="M50 3 91 26.5v47L50 97 9 73.5v-47Z"
          fill="#121212"
          stroke={ring}
          strokeWidth="4"
        />
        <path d="M50 13 82 31.5v37L50 87 18 68.5v-37Z" fill={ring} fillOpacity={locked ? 0.04 : 0.1} />
      </svg>
      <span
        className="relative block"
        style={{ color: glyph, width: Math.round(size * 0.46), height: Math.round(size * 0.46) }}
      >
        <Glyph icon={icon} className="block h-full w-full" />
      </span>
    </span>
  );
}
