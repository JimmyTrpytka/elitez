import type { routing } from "./routing";
import type messages from "./messages/cs.json";

/** Typová kontrola překladů: chybějící nebo překlepnutý klíč odhalí TypeScript. */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
