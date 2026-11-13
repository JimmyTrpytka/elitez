import { getTranslations } from "next-intl/server";
import { SOCIAL_KINDS, type SocialKind } from "@/lib/url";
import { cn } from "@/lib/cn";

function Icon({ kind }: { kind: SocialKind }) {
  const common = { viewBox: "0 0 24 24", className: "h-5 w-5", "aria-hidden": true } as const;
  switch (kind) {
    case "instagram":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common} fill="currentColor">
          <path d="M14.5 3h2.6c.3 2.1 1.6 3.6 3.9 3.8v2.7c-1.5.1-2.8-.4-3.9-1.1v6.4c0 3.3-2.6 5.7-5.7 5.7S5.7 18 5.7 14.8c0-3.4 3-6 6.4-5.6v2.8c-1.6-.4-3.5.7-3.5 2.8 0 1.6 1.3 2.9 2.8 2.9 1.7 0 3.1-1.1 3.1-3.3V3Z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common} fill="currentColor">
          <path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15.2V8.8l5.3 3.2-5.3 3.2Z" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common} fill="currentColor">
          <path d="M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z" />
        </svg>
      );
    default:
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h17M12 3.5c2.5 2.6 3.7 5.4 3.7 8.5S14.5 17.9 12 20.5C9.5 17.9 8.3 15.1 8.3 12S9.5 6.1 12 3.5Z" />
        </svg>
      );
  }
}

/** Kulatá tlačítka s odkazy na sociální sítě (tmavý vzhled). */
export async function SocialLinks({
  links,
  className,
}: {
  links: Partial<Record<`${SocialKind}_url`, string | null>>;
  className?: string;
}) {
  const present = SOCIAL_KINDS.filter((k) => links[`${k}_url`]);
  if (present.length === 0) return null;
  const t = await getTranslations("SocialLinks");
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {present.map((kind) => (
        <li key={kind}>
          <a
            href={links[`${kind}_url`] as string}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={t(`labels.${kind}`)}
            title={t(`labels.${kind}`)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-accent hover:text-ink"
          >
            <Icon kind={kind} />
          </a>
        </li>
      ))}
    </ul>
  );
}
