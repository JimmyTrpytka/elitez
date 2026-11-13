-- =====================================================================
-- Automatické překlady (DeepL) – mezipaměť
-- Každý text se přeloží jen jednou: klíč = otisk (sha256) původního textu
-- + cílový jazyk. Čte a zapisuje jen server s tajným klíčem (service_role),
-- uživatelé k tabulce přístup nemají (RLS bez politik).
-- =====================================================================
create table public.translations (
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  target_lang text not null check (target_lang in ('cs', 'en')),
  source_lang text,
  translated text not null,
  characters integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (source_hash, target_lang)
);

alter table public.translations enable row level security;
revoke all on public.translations from anon, authenticated;

comment on table public.translations is
  'Mezipaměť automatických překladů (DeepL). Přístup jen service_role.';
