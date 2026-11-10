/** Provizorní logo (textové). Skutečné logo se řeší zvlášť. */
export function Logo() {
  return (
    <span className="flex items-center gap-1.5 text-base font-bold tracking-[0.12em] text-ink sm:gap-2 sm:text-lg sm:tracking-[0.2em]">
      <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent" />
      ELITEZ
    </span>
  );
}
