import { cn } from "@/lib/cn";

/** Nápověda nebo chyba pod polem formuláře. Chyba má přednost a je červená. */
export function FieldMessage({
  id,
  hint,
  error,
}: {
  id: string;
  hint?: string;
  error?: string;
}) {
  if (!hint && !error) return null;
  return (
    <p
      id={id}
      role={error ? "alert" : undefined}
      className={cn("text-xs", error ? "font-semibold text-danger" : "text-subtle")}
    >
      {error ?? hint}
    </p>
  );
}

/** Třídy rámečku pole podle toho, jestli je v chybě. */
export function fieldBorder(error?: string) {
  return error
    ? "border-danger bg-danger-soft/40 focus:border-danger"
    : "border-line focus:border-ink";
}
