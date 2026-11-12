import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/** Cookie s pořadatelem, kterého uživatel právě spravuje (vlastní / za crew). */
export const ORGANIZER_COOKIE = "elitez_organizer";

export type MyOrganizerOption = {
  id: string;
  name: string;
  slug: string;
  crewId: string | null;
  crewSlug: string | null;
};

/** Pořadatelé, které přihlášený smí spravovat (ověřuje databáze). */
export async function listMyOrganizers(): Promise<MyOrganizerOption[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.rpc("my_organizers");
  return (data ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    crewId: o.crew_id,
    crewSlug: o.crew_slug,
  }));
}

/** Id pořadatele, kterého uživatel právě spravuje (z cookie, jinak první). */
export async function getCurrentOrganizerId(): Promise<string | null> {
  const [list, store] = await Promise.all([listMyOrganizers(), cookies()]);
  if (list.length === 0) return null;
  const wanted = store.get(ORGANIZER_COOKIE)?.value;
  return list.find((o) => o.id === wanted)?.id ?? list[0].id;
}
