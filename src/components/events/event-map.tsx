"use client";

import { MapView } from "@/components/map/map-view";

/** Mapa s místem eventu (jen k zobrazení). */
export function EventMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  return (
    <MapView
      point={{ lat, lng }}
      ariaLabel={label}
      className="h-80 w-full overflow-hidden rounded-card bg-muted"
    />
  );
}
