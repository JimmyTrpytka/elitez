/**
 * Části překladů, které potřebují komponenty v prohlížeči (useTranslations).
 * Jen tyto se posílají do prohlížeče – zbytek (e-maily, upozornění, …) zůstává
 * na serveru. Test `client-namespaces.test.ts` hlídá, že tu nic nechybí.
 */
export const CLIENT_NAMESPACES = [
  "AdminCrews",
  "AdminUsers",
  "Applications",
  "Attendance",
  "Auth",
  "Beta",
  "Broadcast",
  "CohostErrors",
  "Cohosts",
  "Common",
  "Creator",
  "Crews",
  "Decision",
  "Dreams",
  "Errors",
  "EventAccess",
  "EventCategory",
  "EventForm",
  "EventStatus",
  "Feedback",
  "FeedbackAdmin",
  "Gallery",
  "InfoRequest",
  "Install",
  "Lightbox",
  "Media",
  "MediaErrors",
  "Mods",
  "MyRegistrations",
  "Nav",
  "NotFound",
  "Organizer",
  "OrganizerProfile",
  "Photos",
  "Portfolio",
  "Profile",
  "PromoConsent",
  "Qr",
  "Questions",
  "Registration",
  "RegistrationErrors",
  "RegistrationStatus",
  "RejectionReason",
  "Share",
  "Social",
  "SocialLinks",
  "Translate",
  "Upload",
  "Vehicle",
  "VehicleSettings",
  "Welcome",
] as const;

export function pickClientMessages(messages: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    CLIENT_NAMESPACES.filter((ns) => ns in messages).map((ns) => [ns, messages[ns]]),
  );
}
