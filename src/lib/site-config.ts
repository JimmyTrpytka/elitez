/**
 * Základní údaje o provozovateli a provozu webu.
 * Údaje provozovatele doplní vlastník projektu (používají se na stránce
 * Ochrana osobních údajů).
 */
export const SITE = {
  /** Testovací provoz: zobrazí pruh „Testovací verze“ a odkaz na připomínky. */
  beta: true,
  operator: {
    /** Název firmy provozovatele (správce osobních údajů) */
    name: process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "",
    /** IČO */
    companyId: process.env.NEXT_PUBLIC_OPERATOR_ID ?? "",
    /** Sídlo */
    address: process.env.NEXT_PUBLIC_OPERATOR_ADDRESS ?? "",
    /** Kontaktní e-mail pro otázky k osobním údajům */
    email: process.env.NEXT_PUBLIC_OPERATOR_EMAIL ?? "",
  },
} as const;
