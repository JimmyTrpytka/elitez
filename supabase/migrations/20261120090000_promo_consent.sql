-- =====================================================================
-- Povinný souhlas s využitím fotek a obsahu profilu pro prezentační
-- a propagační účely ELITEZ CLUB (rozhodnuto 13. 11. 2026).
-- - Nový člen ho dává při registraci (zapíše trigger z údajů registrace).
-- - Stávající člen ho jednorázově potvrdí funkcí accept_promo_consent.
-- Ukládá se čas a verze textu, se kterou člen souhlasil.
-- Sám si ho přímo změnit nemůže (bez práva UPDATE na sloupce).
-- =====================================================================

alter table public.profiles
  add column promo_consent_at timestamptz,
  add column promo_consent_version text check (char_length(promo_consent_version) <= 20);

-- Registrace: jazyk + souhlas (verze textu z formuláře)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version text := left(nullif(new.raw_user_meta_data ->> 'promo_consent_version', ''), 20);
begin
  insert into public.profiles (id, locale, promo_consent_at, promo_consent_version)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'cs' end,
    case when v_version is not null then now() end,
    v_version
  );
  return new;
end;
$$;

-- Stávající člen potvrdí souhlas (aktuální verzi textu)
create function public.accept_promo_consent(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if coalesce(char_length(p_version), 0) not between 1 and 20 then raise exception 'invalid_version'; end if;
  update public.profiles
  set promo_consent_at = now(), promo_consent_version = p_version
  where id = auth.uid();
end;
$$;

revoke execute on function public.accept_promo_consent(text) from public, anon;
grant execute on function public.accept_promo_consent(text) to authenticated;
