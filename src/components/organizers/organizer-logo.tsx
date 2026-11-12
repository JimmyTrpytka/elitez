import { cn } from "@/lib/cn";

/** Logo pořadatele, nebo žlutý kruh s iniciálami. */
export function OrganizerLogo({
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
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-display font-extrabold text-ink",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full bg-white object-contain" />
      ) : (
        initials
      )}
    </span>
  );
}
