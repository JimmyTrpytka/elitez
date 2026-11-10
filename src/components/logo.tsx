/** Provizorní logo (textové). Skutečné logo se řeší zvlášť. */
export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-bold tracking-[0.2em] text-ink">
      <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent" />
      ELITEZ
    </span>
  );
}
