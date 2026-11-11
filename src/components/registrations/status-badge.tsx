import { useTranslations } from "next-intl";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/cn";

const styles: Record<Enums<"registration_status">, string> = {
  pending: "bg-muted text-ink",
  approved: "bg-accent text-ink",
  rejected: "bg-danger-soft text-danger",
  waitlist: "bg-ink text-white",
  cancelled: "bg-muted text-subtle line-through",
};

export function RegistrationStatusBadge({
  status,
}: {
  status: Enums<"registration_status">;
}) {
  const t = useTranslations("RegistrationStatus");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        styles[status],
      )}
    >
      {t(status)}
    </span>
  );
}
