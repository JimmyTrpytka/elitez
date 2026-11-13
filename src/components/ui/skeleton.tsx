import { cn } from "@/lib/cn";

/**
 * Šedé obrysy obsahu, dokud se stránka načítá (místo textu „Načítám…“).
 * Stránka tak působí rychleji a nic „neposkočí“, až se obsah objeví.
 */
function Block({ dark, className }: { dark?: boolean; className?: string }) {
  return <div className={cn("animate-pulse rounded-control", dark ? "bg-white/[0.07]" : "bg-muted", className)} />;
}

/** Mřížka karet (eventy, auta, členové, crew). */
export function SkeletonGrid({
  dark = false,
  count = 6,
  label,
  className,
}: {
  dark?: boolean;
  count?: number;
  /** Text pro čtečky obrazovky */
  label: string;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={cn("overflow-hidden rounded-card", dark ? "bg-night-soft" : "bg-surface ring-1 ring-line")}>
            <Block dark={dark} className="aspect-[4/3] w-full rounded-none" />
            <div className="flex flex-col gap-2 p-4">
              <Block dark={dark} className="h-6 w-3/4" />
              <Block dark={dark} className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Celá tmavá stránka detailu (profil, auto, crew, pořadatel): hlavička + obsah. */
export function SkeletonDetail({ label, avatar = false }: { label: string; avatar?: boolean }) {
  return (
    <div role="status" aria-live="polite" className="flex-1 bg-night">
      <span className="sr-only">{label}</span>
      <div aria-hidden>
        <div className="glow-accent border-b border-white/10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pt-28 pb-12 sm:px-6">
            {avatar ? <Block dark className="h-32 w-32 rounded-full" /> : null}
            <Block dark className="h-4 w-40" />
            <Block dark className="h-12 w-2/3 max-w-md" />
            <Block dark className="h-4 w-1/2 max-w-sm" />
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <Block dark className="mb-6 h-9 w-48" />
          <SkeletonGrid dark count={3} label="" />
        </div>
      </div>
    </div>
  );
}
