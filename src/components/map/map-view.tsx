"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

/** Podklad mapy: OpenFreeMap (OpenStreetMap data, zdarma, bez klíče). */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
/** Výchozí střed: Česko. */
export const DEFAULT_CENTER: [number, number] = [15.4, 49.8];

type Point = { lat: number; lng: number };

/**
 * Mapa s jedním špendlíkem.
 * - `onPick` zadaný → kliknutím do mapy se špendlík přesune (pro formulář).
 * - bez `onPick` → jen zobrazení.
 */
export function MapView({
  point,
  onPick,
  className,
  ariaLabel,
}: {
  point: Point | null;
  onPick?: (p: Point) => void;
  className?: string;
  ariaLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const onPickRef = useRef(onPick);
  const initialPoint = useRef(point);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // Vytvoření mapy (jen jednou)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const lib = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      libRef.current = lib;
      const start = initialPoint.current;
      const map = new lib.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: start ? [start.lng, start.lat] : DEFAULT_CENTER,
        zoom: start ? 13 : 6,
        cooperativeGestures: !onPickRef.current,
      });
      map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
      if (start) {
        markerRef.current = new lib.Marker({ color: "#0a0a0a" })
          .setLngLat([start.lng, start.lat])
          .addTo(map);
      }
      map.on("click", (e) => {
        const pick = onPickRef.current;
        if (!pick) return;
        pick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Přesun špendlíku při změně bodu
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) markerRef.current.setLngLat([point.lng, point.lat]);
    else
      markerRef.current = new lib.Marker({ color: "#0a0a0a" })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
  }, [point]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={ariaLabel}
      className={className ?? "h-72 w-full overflow-hidden rounded-control bg-muted"}
    />
  );
}
