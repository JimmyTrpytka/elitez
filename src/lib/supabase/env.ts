/**
 * Adresa a veřejný klíč Supabase z `.env.local`.
 * Veřejný (publishable/anon) klíč smí být v prohlížeči – data chrání
 * Row Level Security v databázi. Tajný (service role) klíč sem NIKDY nepatří.
 */
export type SupabaseEnv = { url: string; key: string };

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}
