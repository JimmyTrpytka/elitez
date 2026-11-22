/** srcset: střední (1200 px) a velká (2048 px) verze fotky – prohlížeč vybere podle displeje. */
export function photoSrcSet(
  medium: string | null | undefined,
  full: string | null | undefined,
): { srcSet?: string; sizes?: string } {
  return medium && full && medium !== full ? { srcSet: `${medium} 1200w, ${full} 2048w`, sizes: "100vw" } : {};
}
