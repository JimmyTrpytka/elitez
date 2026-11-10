import { notFound } from "next/navigation";

// Tahle stránka vždy vrací 404, nemá smysl ji předem připravovat.
export const instant = false;

/** Neznámé adresy (např. /cs/neexistuje) zobrazí stránku „nenalezeno“. */
export default function CatchAll() {
  notFound();
}
