import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type AlertProps = {
  tone: "error" | "success" | "info";
  children: ReactNode;
};

const tones: Record<AlertProps["tone"], string> = {
  error: "bg-danger-soft text-danger",
  success: "bg-success-soft text-success",
  info: "bg-muted text-ink-soft",
};

/** Krátká zpráva pro uživatele (chyba, úspěch, informace). */
export function Alert({ tone, children }: AlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-control px-4 py-3 text-sm", tones[tone])}
    >
      {children}
    </div>
  );
}
