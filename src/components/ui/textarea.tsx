import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { FieldMessage, fieldBorder } from "./field-message";

type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  name: string;
  hint?: string;
  error?: string;
};

export function TextareaField({
  label,
  name,
  hint,
  error,
  className,
  id,
  rows = 4,
  ...props
}: TextareaFieldProps) {
  const inputId = id ?? name;
  const messageId = `${inputId}-message`;
  return (
    <div className="flex flex-col gap-1.5" data-field={name}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={inputId}
        name={name}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? messageId : undefined}
        className={cn(
          "rounded-control border bg-surface px-4 py-3 text-base text-ink placeholder:text-subtle",
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
