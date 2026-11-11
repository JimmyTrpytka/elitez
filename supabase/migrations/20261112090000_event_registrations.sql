-- =====================================================================
-- Milník 4: přihlášky na eventy a schvalování
-- Pravidla viz SPEC.md 5.1c. Klienti do tabulky přihlášek NEZAPISUJÍ přímo;
-- vše jde přes funkce níže, které kontrolují oprávnění, okna registrace a kapacitu.
-- =====================================================================

create type public.registration_status as enum (
  'pending', 'approved', 'rejected', 'waitlist', 'cancelled'
);
create type public.rejection_reason as enum ('capacity', 'criteria', 'incomplete', 'other');

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.registration_status not null default 'pending',
  contact_phone text not null check (char_length(contact_phone) between 5 and 30),
  contact_email text not null check (char_length(contact_email) between 3 and 254 and contact_email like '%@%'),
  message text check (char_length(message) <= 1000),
  consent_at timestamptz not null default now(),
  private_vehicle_ack boolean not null default false,
  rejection_reason public.rejection_reason,
  decision_message text check (char_length(decision_message) <= 1000),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jedno vozidlo = nejvýš jedna nezrušená přihláška na event
create unique index event_registrations_one_per_vehicle
  on public.event_registrations (event_id, vehicle_id)
  where status <> 'cancelled';

create index event_registrations_event_status_idx
  on public.event_registrations (event_id, status, created_at);
create index event_registrations_user_idx on public.event_registrations (user_id);

create trigger event_registrations_set_updated_at
  before update on public.event_registrations
  for each row execute function public.set_updated_at();

alter table public.event_registrations enable row level security;

-- Je přihlášený uživatel pořadatelem daného eventu?
create function public.is_event_organizer(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and e.organizer_id in (select public.my_organizer_ids())
  );
$$;

-- Číst: uchazeč své přihlášky, pořadatel přihlášky na své eventy, admin vše
create policy "registrations: read own or as organizer"
  on public.event_registrations for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_event_organizer(event_id)
    or (select public.is_admin())
  );

-- Žádné přímé zápisy z aplikace – jen přes funkce
revoke insert, update, delete on public.event_registrations from anon, authenticated;

-- ---------------------------------------------------------------------
-- Interní poznámky pořadatele (uchazeč je nikdy nevidí)
-- ---------------------------------------------------------------------
create table public.event_registration_notes (
  registration_id uuid primary key references public.event_registrations (id) on delete cascade,
  note text not null check (char_length(note) <= 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.event_registration_notes enable row level security;

create function public.is_registration_organizer(p_registration_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_registrations r
    where r.id = p_registration_id and public.is_event_organizer(r.event_id)
  );
$$;

create policy "registration notes: organizer only"
  on public.event_registration_notes for all
  to authenticated
  using (public.is_registration_organizer(registration_id))
  with check (public.is_registration_organizer(registration_id));

-- ---------------------------------------------------------------------
-- Pořadatel vidí vozidlo (i soukromé) a profil uchazeče na svůj event
-- (fotky, úpravy a soubory se odvozují od viditelnosti vozidla/profilu)
-- ---------------------------------------------------------------------
create policy "vehicles: organizer reads applicants"
  on public.vehicles for select
  to authenticated
  using (
    exists (
      select 1 from public.event_registrations r
      where r.vehicle_id = vehicles.id and public.is_event_organizer(r.event_id)
    )
  );

create policy "profiles: organizer reads applicants"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.event_registrations r
      where r.user_id = profiles.id and public.is_event_organizer(r.event_id)
    )
  );

-- Vozidlo, které bylo na eventu přihlášené, nejde smazat
create or replace function public.vehicle_has_event_history(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_registrations where vehicle_id = p_vehicle_id
  );
$$;

-- ---------------------------------------------------------------------
-- Doplnění z čekací listiny (interní)
-- ---------------------------------------------------------------------
create function public.fill_from_waitlist(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity integer;
  v_priority boolean;
  v_next uuid;
begin
  select capacity, verified_priority into v_capacity, v_priority
  from public.events where id = p_event_id;
  -- Bez limitu se nic „neuvolňuje“; čekací listinu pak řídí pořadatel ručně
  if v_capacity is null then return; end if;

  loop
    exit when (
      select count(*) from public.event_registrations
      where event_id = p_event_id and status = 'approved'
    ) >= v_capacity;

    select r.id into v_next
    from public.event_registrations r
    join public.profiles p on p.id = r.user_id
    where r.event_id = p_event_id and r.status = 'waitlist'
    order by
      case when v_priority and p.verified_at is not null then 0 else 1 end,
      r.created_at
    limit 1;

    exit when v_next is null;

    update public.event_registrations
    set status = 'approved', decided_at = now(), decided_by = null,
        rejection_reason = null, decision_message = null
    where id = v_next;
  end loop;
end;
$$;

revoke execute on function public.fill_from_waitlist(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Přihlášení vozidla na event
-- Chyby (text výjimky) aplikace překládá: not_signed_in, event_unavailable,
-- invite_only, username_required, verified_only, registration_not_set,
-- not_open_yet, registration_closed, vehicle_invalid, private_ack_required,
-- consent_required, contact_invalid, already_registered
-- ---------------------------------------------------------------------
create function public.register_for_event(
  p_event_id uuid,
  p_vehicle_id uuid,
  p_phone text,
  p_email text,
  p_message text,
  p_consent boolean,
  p_private_ack boolean
)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events;
  v_profile public.profiles;
  v_vehicle public.vehicles;
  v_verified boolean;
  v_opens timestamptz;
  v_status public.registration_status := 'pending';
  v_row public.event_registrations;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;

  -- Zámek eventu: souběžné přihlášky se zpracují postupně (kapacita)
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'published' then
    raise exception 'event_unavailable';
  end if;
  if v_event.access = 'invite_only' then raise exception 'invite_only'; end if;

  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.username is null then raise exception 'username_required'; end if;
  v_verified := v_profile.verified_at is not null;

  if v_event.access = 'verified_only' and not v_verified then
    raise exception 'verified_only';
  end if;

  if v_event.registration_opens_at is null then raise exception 'registration_not_set'; end if;
  v_opens := case
    when v_verified then coalesce(v_event.registration_verified_opens_at, v_event.registration_opens_at)
    else v_event.registration_opens_at
  end;
  if now() < v_opens then raise exception 'not_open_yet'; end if;
  if (v_event.registration_closes_at is not null and now() > v_event.registration_closes_at)
     or now() >= v_event.starts_at then
    raise exception 'registration_closed';
  end if;

  select * into v_vehicle from public.vehicles where id = p_vehicle_id;
  if not found or v_vehicle.owner_id <> v_uid or v_vehicle.status <> 'current' then
    raise exception 'vehicle_invalid';
  end if;
  if (v_vehicle.visibility = 'private' or v_profile.visibility = 'private')
     and not coalesce(p_private_ack, false) then
    raise exception 'private_ack_required';
  end if;
  if not coalesce(p_consent, false) then raise exception 'consent_required'; end if;

  if coalesce(char_length(trim(p_phone)), 0) not between 5 and 30
     or coalesce(trim(p_email), '') not like '%_@_%'
     or char_length(trim(p_email)) > 254
     or char_length(coalesce(p_message, '')) > 1000 then
    raise exception 'contact_invalid';
  end if;

  if exists (
    select 1 from public.event_registrations
    where event_id = p_event_id and vehicle_id = p_vehicle_id and status <> 'cancelled'
  ) then
    raise exception 'already_registered';
  end if;

  -- Plná kapacita → rovnou na čekací listinu
  if v_event.capacity is not null and (
    select count(*) from public.event_registrations
    where event_id = p_event_id and status = 'approved'
  ) >= v_event.capacity then
    v_status := 'waitlist';
  end if;

  insert into public.event_registrations (
    event_id, vehicle_id, user_id, status, contact_phone, contact_email, message,
    private_vehicle_ack
  ) values (
    p_event_id, p_vehicle_id, v_uid, v_status, trim(p_phone), lower(trim(p_email)),
    nullif(trim(coalesce(p_message, '')), ''), coalesce(p_private_ack, false)
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- Zrušení přihlášky uchazečem (před začátkem eventu)
-- ---------------------------------------------------------------------
create function public.cancel_registration(p_registration_id uuid)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_registrations;
  v_event public.events;
  v_was_approved boolean;
begin
  select * into v_row from public.event_registrations where id = p_registration_id;
  if not found or v_row.user_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if v_row.status not in ('pending', 'approved', 'waitlist') then raise exception 'not_cancellable'; end if;

  select * into v_event from public.events where id = v_row.event_id for update;
  if now() >= v_event.starts_at then raise exception 'event_started'; end if;

  v_was_approved := v_row.status = 'approved';
  update public.event_registrations
  set status = 'cancelled', cancelled_at = now()
  where id = p_registration_id
  returning * into v_row;

  if v_was_approved then perform public.fill_from_waitlist(v_row.event_id); end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- Rozhodnutí pořadatele: approved / rejected / waitlist / pending
-- Při plné kapacitě se „schválit“ změní na čekací listinu.
-- ---------------------------------------------------------------------
create function public.decide_registration(
  p_registration_id uuid,
  p_decision public.registration_status,
  p_reason public.rejection_reason default null,
  p_message text default null
)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_registrations;
  v_event public.events;
  v_target public.registration_status := p_decision;
  v_was_approved boolean;
begin
  select * into v_row from public.event_registrations where id = p_registration_id;
  if not found or not public.is_event_organizer(v_row.event_id) then
    raise exception 'not_allowed';
  end if;
  if p_decision not in ('approved', 'rejected', 'waitlist', 'pending') then
    raise exception 'invalid_decision';
  end if;
  if v_row.status = 'cancelled' then raise exception 'cancelled'; end if;
  if char_length(coalesce(p_message, '')) > 1000 then raise exception 'message_too_long'; end if;

  select * into v_event from public.events where id = v_row.event_id for update;
  v_was_approved := v_row.status = 'approved';

  if v_target = 'approved' and not v_was_approved and v_event.capacity is not null and (
    select count(*) from public.event_registrations
    where event_id = v_row.event_id and status = 'approved'
  ) >= v_event.capacity then
    v_target := 'waitlist';
  end if;

  update public.event_registrations
  set status = v_target,
      rejection_reason = case when v_target = 'rejected' then coalesce(p_reason, 'other') else null end,
      decision_message = case when v_target = 'rejected'
        then nullif(trim(coalesce(p_message, '')), '') else null end,
      decided_at = now(),
      decided_by = auth.uid()
  where id = p_registration_id
  returning * into v_row;

  if v_was_approved and v_target <> 'approved' then
    perform public.fill_from_waitlist(v_row.event_id);
    select * into v_row from public.event_registrations where id = p_registration_id;
  end if;
  return v_row;
end;
$$;

revoke execute on function public.register_for_event(uuid, uuid, text, text, text, boolean, boolean) from public, anon;
revoke execute on function public.cancel_registration(uuid) from public, anon;
revoke execute on function public.decide_registration(uuid, public.registration_status, public.rejection_reason, text) from public, anon;
grant execute on function public.register_for_event(uuid, uuid, text, text, text, boolean, boolean) to authenticated;
grant execute on function public.cancel_registration(uuid) to authenticated;
grant execute on function public.decide_registration(uuid, public.registration_status, public.rejection_reason, text) to authenticated;
