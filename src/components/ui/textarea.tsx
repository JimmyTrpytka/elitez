import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  name: string;
  hint?: string;
};

export function TextareaField({
  label,
  name,
  hint,
  className,
  id,
  rows = 4,
  ...props
}: TextareaFieldProps) {
  const inputId = id ?? name;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={inputId}
        name={name}
        rows={rows}
        aria-describedby={hintId}
        className={cn(
          "rounded-control border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-subtle",
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
