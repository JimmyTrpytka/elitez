import { useTranslations } from "next-intl";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/cn";

const styles: Record<Enums<"event_status">, string> = {
  draft: "bg-muted text-ink-soft",
  published: "bg-accent text-ink",
  closed: "bg-ink text-white",
  cancelled: "bg-danger-soft text-danger",
};

export function EventStatusBadge({ status }: { status: Enums<"event_status"> }) {
  const t = useTranslations("EventStatus");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        styles[status],
      )}
    >
      {t(status)}
    </span>
  );
}

export function EventAccessBadge({ access }: { access: Enums<"event_access"> }) {
  const t = useTranslations("EventAccess");
  if (access === "public") return null;
  return (
    <span className="inline-flex items-center rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">
      {t(access)}
    </span>
  );
}
