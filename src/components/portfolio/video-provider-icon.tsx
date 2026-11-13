import type { VideoProvider } from "@/lib/portfolio/video";

/** Ikona služby, kde je video (YouTube, Instagram, TikTok, Vimeo). */
export function VideoProviderIcon({ provider, className }: { provider: VideoProvider; className?: string }) {
  const common = { viewBox: "0 0 24 24", className, "aria-hidden": true } as const;
  switch (provider) {
    case "youtube":
      return (
        <svg {...common} fill="currentColor">
          <path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15.2V8.8l5.3 3.2-5.3 3.2Z" />
        </svg>
      );
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
    case "vimeo":
      return (
        <svg {...common} fill="currentColor">
          <path d="M21.9 7.4c-.1 2-1.5 4.7-4.2 8.1-2.8 3.6-5.1 5.4-7 5.4-1.2 0-2.2-1.1-3-3.3L6.1 12c-.6-2.2-1.2-3.3-1.9-3.3-.1 0-.7.3-1.6.9l-1-1.2 3-2.6c1.3-1.2 2.3-1.8 3-1.8 1.6-.2 2.5.9 2.9 3.2.4 2.5.7 4.1.8 4.7.5 2.1 1 3.1 1.5 3.1.4 0 1.1-.7 2-2.1.9-1.4 1.4-2.5 1.5-3.2.1-1.2-.3-1.8-1.5-1.8-.5 0-1 .1-1.6.3 1-3.4 3-5.1 6-5 2.2.1 3.2 1.5 3.1 4.2Z" />
        </svg>
      );
  }
}
