import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  hint?: string;
};

/** Textové pole s popiskem a volitelnou nápovědou. */
export function Field({ label, name, hint, className, id, ...props }: FieldProps) {
  const inputId = id ?? name;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-describedby={hintId}
        className={cn(
          "h-12 rounded-control border border-line bg-surface px-4 text-base text-ink placeholder:text-subtle",
          "transition-colors focus:border-ink focus:outline-none",
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
