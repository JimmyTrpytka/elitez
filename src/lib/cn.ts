/** Spojí CSS třídy dohromady a vynechá prázdné hodnoty. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
