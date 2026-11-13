import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

/** Prodaná auta jsou teď přímo v garáži (sekce Prodaná auta). */
export default async function ArchivePage() {
  const locale = await getLocale();
  redirect(`/${locale}/garage#prodana`);
}
