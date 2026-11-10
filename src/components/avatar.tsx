import { cn } from "@/lib/cn";

/** Kulatý avatar: fotka, nebo první písmeno jména na šedém pozadí. */
export function Avatar({
  url,
  name,
  size = 64,
  className,
}: {
  url: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-ink-soft",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {url ? (
        // Fotka je už zmenšená při nahrání a podepsaná – optimalizace Next.js není potřeba
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initial}</span>
      )}
    </span>
  );
}
