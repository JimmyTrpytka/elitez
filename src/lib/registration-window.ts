/**
 * Stav registrace na event pro konkrétního uživatele – jen pro ZOBRAZENÍ.
 * Závazně stejná pravidla kontroluje databáze (funkce register_for_event).
 */
export type RegistrationEventFields = {
  status: "draft" | "published" | "closed" | "cancelled";
  // crew_only: event vidí jen členové crew (RLS), pro ně platí pravidla jako u veřejného
  access: "public" | "verified_only" | "invite_only" | "crew_only";
  starts_at: string;
  registration_opens_at: string | null;
  registration_verified_opens_at: string | null;
  registration_closes_at: string | null;
};

export type RegistrationWindow =
  | { kind: "not_published" }
  | { kind: "cancelled" }
  | { kind: "closed"; reason: "organizer" | "deadline" | "started"; startsAt?: string }
  | { kind: "invite_only" }
  | { kind: "verified_only" }
  | { kind: "not_set" }
  | { kind: "not_open_yet"; opensAt: string; verifiedOpensAt: string | null }
  | { kind: "open"; closesAt: string | null };

export function registrationWindow(
  event: RegistrationEventFields,
  isVerified: boolean,
  now: Date = new Date(),
): RegistrationWindow {
  if (event.status === "cancelled") return { kind: "cancelled" };
  if (event.status === "draft") return { kind: "not_published" };
  if (event.status === "closed") return { kind: "closed", reason: "organizer" };
  if (event.access === "invite_only") return { kind: "invite_only" };
  if (event.access === "verified_only" && !isVerified) return { kind: "verified_only" };
  if (!event.registration_opens_at) return { kind: "not_set" };

  const opens =
    isVerified && event.registration_verified_opens_at
      ? event.registration_verified_opens_at
      : event.registration_opens_at;
  const t = now.getTime();
  if (t < new Date(opens).getTime()) {
    const verifiedEarlier =
      !isVerified &&
      event.registration_verified_opens_at &&
      event.registration_verified_opens_at < event.registration_opens_at
        ? event.registration_verified_opens_at
        : null;
    return { kind: "not_open_yet", opensAt: opens, verifiedOpensAt: verifiedEarlier };
  }
  // Přihlašovat se dá jen do začátku eventu (i když je uzávěrka nastavená později)
  if (t >= new Date(event.starts_at).getTime()) {
    return { kind: "closed", reason: "started", startsAt: event.starts_at };
  }
  if (event.registration_closes_at && t > new Date(event.registration_closes_at).getTime()) {
    return { kind: "closed", reason: "deadline" };
  }
  return { kind: "open", closesAt: event.registration_closes_at };
}

/**
 * Je otevřené okno pro potvrzení účasti? (X dní před začátkem až do začátku)
 * Stejné pravidlo jako databázová funkce attendance_window_open.
 */
export function attendanceWindowOpen(
  startsAt: string,
  confirmDaysBefore: number | null,
  now: number = Date.now(),
): boolean {
  if (!confirmDaysBefore) return false;
  const start = new Date(startsAt).getTime();
  return now >= start - confirmDaysBefore * 24 * 60 * 60 * 1000 && now < start;
}


export type CardBadge =
  | { kind: "open" }
  | { kind: "last"; left: number }
  | { kind: "full" }
  | { kind: "soon"; opensAt: string };

/**
 * Štítek na kartě eventu v seznamu: registrace otevřená / poslední místa /
 * plno (čekací listina) / registrace od… Čas se bere jako pro Verified,
 * aby karta ukázala nejbližší otevření (detail pak vysvětlí podrobnosti).
 */
export function cardRegistrationBadge(
  event: RegistrationEventFields & { capacity: number | null },
  approvedCount: number | null,
  now: Date = new Date(),
): CardBadge | null {
  const w = registrationWindow(event, true, now);
  if (w.kind === "not_open_yet") return { kind: "soon", opensAt: w.opensAt };
  if (w.kind !== "open") return null;
  if (event.capacity !== null && approvedCount !== null) {
    const left = event.capacity - approvedCount;
    if (left <= 0) return { kind: "full" };
    if (left <= Math.max(2, Math.ceil(event.capacity * 0.1))) return { kind: "last", left };
  }
  return { kind: "open" };
}
