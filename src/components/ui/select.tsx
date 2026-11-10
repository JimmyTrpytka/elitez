import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  name: string;
  hint?: string;
  children: ReactNode;
};

export function SelectField({
  label,
  name,
  hint,
  className,
  id,
  children,
  ...props
}: SelectFieldProps) {
  const inputId = id ?? name;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={inputId}
          name={name}
          aria-describedby={hintId}
          className={cn(
            "h-12 w-full appearance-none rounded-control border border-line bg-surface px-4 pr-10 text-base text-ink",
            "transition-colors focus:border-ink focus:outline-none",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-subtle"
        >
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
