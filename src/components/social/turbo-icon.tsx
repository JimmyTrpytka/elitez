import { cn } from "@/lib/cn";

/**
 * Ikona turbodmychadla: „šnek“ s výstupem a lopatkové kolo uprostřed.
 * Kolo má třídu `turbo-wheel` – při udělení turba se roztočí (globals.css).
 */
export function TurboIcon({ className, filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5", className)}
      aria-hidden
    >
      {/* Skříň a výstupní hrdlo */}
      <path
        d="M11 5a8 8 0 1 0 8 8V9h2V5H11Z"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.18 : 0}
      />
      <path d="M21 3.5v7" />
      {/* Lopatkové kolo */}
      <g className="turbo-wheel" strokeWidth="1.5">
        <circle cx="11" cy="13" r="1.4" fill="currentColor" />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <path key={deg} d="M11 13q2.8-.6 2.9-4.4" transform={`rotate(${deg} 11 13)`} />
        ))}
      </g>
    </svg>
  );
}

/** Kompaktní zápis počtu (1,2 tis. / 1.2K). */
export function formatCount(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: n >= 10000 ? "compact" : "standard" }).format(n);
}
