-- =====================================================================
-- Milník 3: pořadatelé, sezóny, eventy
-- Pravidla viz SPEC.md 5.1, 5.1b a CLAUDE.md.
-- =====================================================================

create type public.organizer_status as enum ('pending', 'approved', 'suspended');
create type public.event_status as enum ('draft', 'published', 'closed', 'cancelled');
create type public.event_access as enum ('public', 'verified_only', 'invite_only');
create type public.event_category as enum (
  'tuning', 'youngtimer', 'american', 'veteran', 'classic', 'motorcycle', 'mix'
);

-- ---------------------------------------------------------------------
-- Pomocné funkce pro oprávnění (security definer = bez zacyklení RLS)
-- ---------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- organizers – pořadatelé (promotéři)
-- ---------------------------------------------------------------------
create table public.organizers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 2000),
  status public.organizer_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizers_set_updated_at
  before update on public.organizers
  for each row execute function public.set_updated_at();

alter table public.organizers enable row level security;

-- Pořadatelské účty přihlášeného uživatele (jen schválené)
create function public.my_organizer_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.organizers
  where profile_id = (select auth.uid()) and status = 'approved';
$$;

create policy "organizers: read approved, own or admin"
  on public.organizers for select
  to anon, authenticated
  using (
    status = 'approved'
    or profile_id = (select auth.uid())
    or (select public.is_admin())
  );

-- Zakládat a schvalovat pořadatele smí jen admin
create policy "organizers: admin insert"
  on public.organizers for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "organizers: admin update"
  on public.organizers for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Pořadatel smí měnit jen název a popis (ne stav); admin vše
create policy "organizers: owner update profile"
  on public.organizers for update
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

revoke update on public.organizers from authenticated;
grant update (name, description) on public.organizers to authenticated;
-- Stav mění admin přes funkci níže (sloupcové právo na status nemá nikdo z aplikace)
revoke delete on public.organizers from anon, authenticated;

create function public.admin_set_organizer_status(
  p_organizer_id uuid,
  p_status public.organizer_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.organizers set status = p_status where id = p_organizer_id;
end;
$$;

-- ---------------------------------------------------------------------
-- seasons – sezóny
-- ---------------------------------------------------------------------
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  year smallint not null check (year between 2000 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index seasons_organizer_id_idx on public.seasons (organizer_id, year);

create trigger seasons_set_updated_at
  before update on public.seasons
  for each row execute function public.set_updated_at();

alter table public.seasons enable row level security;

create policy "seasons: read all"
  on public.seasons for select
  to anon, authenticated
  using (true);

create policy "seasons: organizer insert"
  on public.seasons for insert
  to authenticated
  with check (organizer_id in (select public.my_organizer_ids()));

create policy "seasons: organizer update"
  on public.seasons for update
  to authenticated
  using (organizer_id in (select public.my_organizer_ids()))
  with check (organizer_id in (select public.my_organizer_ids()));

create policy "seasons: organizer delete"
  on public.seasons for delete
  to authenticated
  using (organizer_id in (select public.my_organizer_ids()));

-- ---------------------------------------------------------------------
-- events – eventy
-- ---------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete restrict,
  season_id uuid references public.seasons (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 5000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Europe/Prague',
  venue_name text check (char_length(venue_name) <= 120),
  venue_address text check (char_length(venue_address) <= 200),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  country text check (country ~ '^[A-Z]{2}$'),
  category public.event_category not null default 'mix',
  capacity integer check (capacity between 1 and 100000),
  selection_criteria text check (char_length(selection_criteria) <= 5000),
  program text check (char_length(program) <= 5000),
  rules text check (char_length(rules) <= 5000),
  access public.event_access not null default 'public',
  verified_priority boolean not null default true,
  verified_head_start_hours integer not null default 0
    check (verified_head_start_hours in (0, 24, 72, 168, 720)),
  registration_opens_at timestamptz,
  registration_verified_opens_at timestamptz,
  registration_closes_at timestamptz,
  status public.event_status not null default 'draft',
  cover_path text,
  cover_format text check (cover_format in ('webp', 'jpg')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_ends_after_start check (ends_at >= starts_at),
  constraint events_registration_order check (
    registration_closes_at is null
    or registration_opens_at is null
    or registration_closes_at > registration_opens_at
  )
);

create index events_status_starts_idx on public.events (status, starts_at);
create index events_organizer_idx on public.events (organizer_id);
create index events_season_idx on public.events (season_id);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- Termín registrace pro Verified = otevření registrace mínus předstih.
-- Při zveřejnění se zapíše published_at.
create function public.events_compute_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.registration_opens_at is null then
    new.registration_verified_opens_at = null;
  else
    new.registration_verified_opens_at =
      new.registration_opens_at - make_interval(hours => new.verified_head_start_hours);
  end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger events_compute_fields
  before insert or update on public.events
  for each row execute function public.events_compute_fields();

-- Sezóna musí patřit stejnému pořadateli jako event
create function public.season_belongs_to(p_season_id uuid, p_organizer_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_season_id is null or exists (
    select 1 from public.seasons s
    where s.id = p_season_id and s.organizer_id = p_organizer_id
  );
$$;

alter table public.events enable row level security;

-- Číst: zveřejněné/uzavřené/zrušené veřejné a „jen Verified“ eventy kdokoli;
-- koncepty a eventy na pozvánky jen jejich pořadatel (a admin).
create policy "events: read visible"
  on public.events for select
  to anon, authenticated
  using (
    (status <> 'draft' and access in ('public', 'verified_only'))
    or organizer_id in (select public.my_organizer_ids())
    or (select public.is_admin())
  );

create policy "events: organizer insert"
  on public.events for insert
  to authenticated
  with check (
    organizer_id in (select public.my_organizer_ids())
    and public.season_belongs_to(season_id, organizer_id)
  );

create policy "events: organizer update"
  on public.events for update
  to authenticated
  using (organizer_id in (select public.my_organizer_ids()))
  with check (
    organizer_id in (select public.my_organizer_ids())
    and public.season_belongs_to(season_id, organizer_id)
  );

-- Smazat jde jen koncept (zveřejněný event se ruší stavem „zrušený“)
create policy "events: organizer delete drafts"
  on public.events for delete
  to authenticated
  using (
    organizer_id in (select public.my_organizer_ids())
    and status = 'draft'
  );

-- ---------------------------------------------------------------------
-- Úložiště obrázků eventů: {event_id}/{image_id}-{velikost}.{format}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "event-images: read if event visible"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'event-images'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(name))[1]
    )
  );

create policy "event-images: organizer upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-images'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.organizer_id in (select public.my_organizer_ids())
    )
  );

create policy "event-images: organizer delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-images'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.organizer_id in (select public.my_organizer_ids())
    )
  );
