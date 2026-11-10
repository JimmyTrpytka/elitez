import { cn } from "@/lib/cn";

type Choice = { value: string; title: string; description?: string };

/** Výběr jedné z možností jako velké „karty“ (dobře se ťuká na mobilu). */
export function ChoiceCards({
  legend,
  name,
  choices,
  defaultValue,
}: {
  legend: string;
  name: string;
  choices: Choice[];
  defaultValue: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-ink">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((c) => (
          <label
            key={c.value}
            className={cn(
              "flex cursor-pointer gap-3 rounded-control border border-line p-4 transition-colors",
              "has-[:checked]:border-ink has-[:checked]:bg-muted",
            )}
          >
            <input
              type="radio"
              name={name}
              value={c.value}
              defaultChecked={c.value === defaultValue}
              className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
            />
            <span>
              <span className="block font-semibold text-ink">{c.title}</span>
              {c.description ? (
                <span className="mt-0.5 block text-sm text-ink-soft">
                  {c.description}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
