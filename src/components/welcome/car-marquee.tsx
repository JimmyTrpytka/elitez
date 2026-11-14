import { Link } from "@/i18n/navigation";
import type { ShowcaseVehicle } from "@/lib/data/vehicles";

/** Nekonečný pás fotek aut členů (pás je dvakrát za sebou kvůli plynulé smyčce). */
export function CarMarquee({ vehicles }: { vehicles: ShowcaseVehicle[] }) {
  const cars = vehicles.filter((v) => v.cover?.urls.md || v.cover?.urls.sm);
  if (cars.length < 3) return null;
  const loop = [...cars, ...cars];
  return (
    <div className="marquee relative overflow-hidden py-2">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-night to-transparent sm:w-32" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-night to-transparent sm:w-32" />
      <ul className="marquee-track flex gap-3 sm:gap-4">
        {loop.map((v, i) => (
          <li key={`${v.id}-${i}`} aria-hidden={i >= cars.length ? true : undefined} className="shrink-0">
            <Link
              href={`/v/${v.id}`}
              tabIndex={i >= cars.length ? -1 : undefined}
              className="group relative block h-40 w-60 overflow-hidden rounded-card sm:h-56 sm:w-80"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.cover?.urls.md ?? v.cover?.urls.sm}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-3">
                <span className="block font-display text-xl leading-tight font-extrabold text-white uppercase">
                  {v.make} {v.model}
                </span>
                {v.ownerUsername ? <span className="text-xs text-white/70">@{v.ownerUsername}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
