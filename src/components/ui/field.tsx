import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { FieldMessage, fieldBorder } from "./field-message";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  hint?: string;
  /** Chybová hláška k tomuto poli (zobrazí se pod ním, pole zčervená). */
  error?: string;
};

/** Textové pole s popiskem, nápovědou a případnou chybou. */
export function Field({ label, name, hint, error, className, id, ...props }: FieldProps) {
  const inputId = id ?? name;
  const messageId = `${inputId}-message`;
  return (
    <div className="flex flex-col gap-1.5" data-field={name}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? messageId : undefined}
        className={cn(
          "h-12 rounded-control border bg-surface px-4 text-base text-ink placeholder:text-subtle",
          "transition-colors focus:outline-none",
          fieldBorder(error),
          className,
        )}
        {...props}
      />
      <FieldMessage id={messageId} hint={hint} error={error} />
    </div>
  );
}
