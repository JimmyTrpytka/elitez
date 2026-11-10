-- =====================================================================
-- Milník 2: profil a garáž
-- Tabulky: profiles, vehicles, vehicle_photos, vehicle_mods
-- Úložiště: avatars, vehicle-photos (obě SOUKROMÉ, přístup řídí RLS)
-- Pravidla viz SPEC.md 5.1 a 5.1a, CLAUDE.md.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Číselníky
-- ---------------------------------------------------------------------
create type public.visibility as enum ('public', 'private');
create type public.vehicle_type as enum ('car', 'motorcycle');
create type public.vehicle_category as enum (
  'tuning', 'youngtimer', 'american', 'veteran', 'classic', 'motorcycle', 'other'
);
create type public.vehicle_status as enum ('current', 'former');
create type public.mod_category as enum (
  'engine', 'drivetrain', 'suspension', 'wheels', 'brakes',
  'exterior', 'interior', 'audio', 'other'
);

-- Automatické vyplnění updated_at
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles – jeden řádek na uživatele, vzniká automaticky při registraci
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique
    check (username ~ '^[a-z0-9._]{3,30}$'),
  display_name text check (char_length(display_name) between 1 and 60),
  country text check (country ~ '^[A-Z]{2}$'),
  city text check (char_length(city) <= 80),
  bio text check (char_length(bio) <= 500),
  avatar_path text,
  visibility public.visibility not null default 'public',
  -- role a verified_at mění jen admin (uživatel nemá právo UPDATE na tyto sloupce)
  role text not null default 'member' check (role in ('member', 'admin')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Číst: veřejné profily kdokoli, svůj profil vždy
create policy "profiles: read public or own"
  on public.profiles for select
  to anon, authenticated
  using (visibility = 'public' or id = (select auth.uid()));

-- Upravit: jen svůj profil
create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Uživatel smí měnit JEN tyto sloupce (ne role, ne verified_at, ne id)
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, display_name, country, city, bio, avatar_path, visibility)
  on public.profiles to authenticated;

-- Založení profilu při registraci
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profily pro uživatele, kteří se zaregistrovali už v Milníku 1
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- vehicles – garáž
-- ---------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  type public.vehicle_type not null default 'car',
  category public.vehicle_category not null,
  make text not null check (char_length(make) between 1 and 60),
  model text not null check (char_length(model) between 1 and 80),
  year smallint check (year between 1885 and 2100),
  engine text check (char_length(engine) <= 120),
  power_hp integer check (power_hp between 1 and 5000),
  description text check (char_length(description) <= 2000),
  story text check (char_length(story) <= 5000),
  country text check (country ~ '^[A-Z]{2}$'),
  visibility public.visibility not null default 'public',
  status public.vehicle_status not null default 'current',
  acquired_on date,
  sold_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vehicles_owner_id_idx on public.vehicles (owner_id);

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

alter table public.vehicles enable row level security;

-- Má vozidlo historii na eventech? (Do Milníku 4 vždy false, pak se funkce
-- přepíše tak, aby kontrolovala event_registrations.) Takové vozidlo nejde smazat.
create function public.vehicle_has_event_history(p_vehicle_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select false;
$$;

-- Číst: své vždy; cizí jen veřejné vozidlo ve veřejném profilu
create policy "vehicles: read public or own"
  on public.vehicles for select
  to anon, authenticated
  using (
    owner_id = (select auth.uid())
    or (
      visibility = 'public'
      and exists (
        select 1 from public.profiles p
        where p.id = vehicles.owner_id and p.visibility = 'public'
      )
    )
  );

create policy "vehicles: insert own"
  on public.vehicles for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "vehicles: update own"
  on public.vehicles for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "vehicles: delete own without event history"
  on public.vehicles for delete
  to authenticated
  using (
    owner_id = (select auth.uid())
    and not public.vehicle_has_event_history(id)
  );

-- ---------------------------------------------------------------------
-- vehicle_photos – fotky (soubory v úložišti vehicle-photos)
-- Soubory: {vehicle_id}/{photo_id}-sm.webp, -md.webp, -lg.webp
-- Hlavní fotka = nejnižší position.
-- ---------------------------------------------------------------------
create table public.vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  position smallint not null default 0,
  width integer check (width > 0),
  height integer check (height > 0),
  created_at timestamptz not null default now()
);

create index vehicle_photos_vehicle_id_idx
  on public.vehicle_photos (vehicle_id, position);

alter table public.vehicle_photos enable row level security;

-- Pomocná funkce: patří vozidlo přihlášenému uživateli?
create function public.owns_vehicle(p_vehicle_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id and v.owner_id = (select auth.uid())
  );
$$;

-- Číst: když je vidět samotné vozidlo (uplatní se RLS tabulky vehicles)
create policy "vehicle_photos: read if vehicle visible"
  on public.vehicle_photos for select
  to anon, authenticated
  using (exists (select 1 from public.vehicles v where v.id = vehicle_id));

create policy "vehicle_photos: insert own"
  on public.vehicle_photos for insert
  to authenticated
  with check (public.owns_vehicle(vehicle_id));

create policy "vehicle_photos: update own"
  on public.vehicle_photos for update
  to authenticated
  using (public.owns_vehicle(vehicle_id))
  with check (public.owns_vehicle(vehicle_id));

create policy "vehicle_photos: delete own"
  on public.vehicle_photos for delete
  to authenticated
  using (public.owns_vehicle(vehicle_id));

-- Nejvýš 20 fotek na vozidlo
create function public.enforce_photo_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.vehicle_photos where vehicle_id = new.vehicle_id) >= 20 then
    raise exception 'photo_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger vehicle_photos_limit
  before insert on public.vehicle_photos
  for each row execute function public.enforce_photo_limit();

-- ---------------------------------------------------------------------
-- vehicle_mods – seznam úprav
-- ---------------------------------------------------------------------
create table public.vehicle_mods (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  category public.mod_category not null default 'other',
  description text not null check (char_length(description) between 1 and 300),
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index vehicle_mods_vehicle_id_idx
  on public.vehicle_mods (vehicle_id, position);

alter table public.vehicle_mods enable row level security;

create policy "vehicle_mods: read if vehicle visible"
  on public.vehicle_mods for select
  to anon, authenticated
  using (exists (select 1 from public.vehicles v where v.id = vehicle_id));

create policy "vehicle_mods: insert own"
  on public.vehicle_mods for insert
  to authenticated
  with check (public.owns_vehicle(vehicle_id));

create policy "vehicle_mods: update own"
  on public.vehicle_mods for update
  to authenticated
  using (public.owns_vehicle(vehicle_id))
  with check (public.owns_vehicle(vehicle_id));

create policy "vehicle_mods: delete own"
  on public.vehicle_mods for delete
  to authenticated
  using (public.owns_vehicle(vehicle_id));

-- ---------------------------------------------------------------------
-- Úložiště souborů (Storage)
-- Obě úložiště jsou soukromá: soubory se zobrazují přes dočasné podepsané
-- odkazy a jen tomu, kdo smí vidět profil/vozidlo.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 2097152, array['image/webp']),
  ('vehicle-photos', 'vehicle-photos', false, 5242880, array['image/webp'])
on conflict (id) do nothing;

-- Avatary: {user_id}/{nazev}.webp
create policy "avatars: read if profile visible"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'avatars'
    and exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(name))[1]
    )
  );

create policy "avatars: upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Fotky vozidel: {vehicle_id}/{photo_id}-{velikost}.webp
create policy "vehicle-photos: read if vehicle visible"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'vehicle-photos'
    and exists (
      select 1 from public.vehicles v
      where v.id::text = (storage.foldername(name))[1]
    )
  );

create policy "vehicle-photos: upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vehicle-photos'
    and exists (
      select 1 from public.vehicles v
      where v.id::text = (storage.foldername(name))[1]
        and v.owner_id = (select auth.uid())
    )
  );

create policy "vehicle-photos: delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and exists (
      select 1 from public.vehicles v
      where v.id::text = (storage.foldername(name))[1]
        and v.owner_id = (select auth.uid())
    )
  );
