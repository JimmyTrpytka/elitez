-- =====================================================================
-- Registrace na srazy – vylepšení, část 1 (rozhodnuto 17. 11. 2026, SPEC 5.1k)
-- A) minimální počet fotek auta, J) automatické schvalování,
-- C) úprava čekající přihlášky, E) informace pro schválené účastníky
-- =====================================================================

alter table public.events
  add column min_photos smallint not null default 0 check (min_photos between 0 and 10),
  add column auto_approve boolean not null default false;

-- Stávající eventy: 3 fotky (nové eventy dostanou 3 předvyplněné ve formuláři)
update public.events set min_photos = 3;

-- ---------------------------------------------------------------------
-- E) Informace pro schválené (příjezd, čas, parkování…)
-- Samostatná tabulka: events čte kdokoli, tohle jen schválení a pořadatel.
-- ---------------------------------------------------------------------
create table public.event_participant_info (
  event_id uuid primary key references public.events (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.event_participant_info enable row level security;

-- Má přihlášený uživatel na eventu schválenou přihlášku?
create function public.is_approved_participant(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_registrations
    where event_id = p_event_id and user_id = auth.uid() and status = 'approved'
  );
$$;

create policy "participant info: approved or organizer reads"
  on public.event_participant_info for select
  to authenticated
  using (
    public.is_event_organizer(event_id)
    or public.is_approved_participant(event_id)
    or (select public.is_admin())
  );

create policy "participant info: organizer writes"
  on public.event_participant_info for insert
  to authenticated
  with check (public.is_event_organizer(event_id));

create policy "participant info: organizer updates"
  on public.event_participant_info for update
  to authenticated
  using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

create policy "participant info: organizer deletes"
  on public.event_participant_info for delete
  to authenticated
  using (public.is_event_organizer(event_id));

-- ---------------------------------------------------------------------
-- Přihlášení: kontrola fotek (A) a automatické schválení (J)
-- Nové chyby: not_enough_photos
-- ---------------------------------------------------------------------
create or replace function public.register_for_event(
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
  v_full boolean;
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
  if (select count(*) from public.vehicle_photos where vehicle_id = p_vehicle_id) < v_event.min_photos then
    raise exception 'not_enough_photos';
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

  v_full := v_event.capacity is not null and (
    select count(*) from public.event_registrations
    where event_id = p_event_id and status = 'approved'
  ) >= v_event.capacity;

  -- Plná kapacita → čekací listina; automatické schvalování → rovnou schváleno
  if v_full then
    v_status := 'waitlist';
  elsif v_event.auto_approve then
    v_status := 'approved';
  end if;

  insert into public.event_registrations (
    event_id, vehicle_id, user_id, status, contact_phone, contact_email, message,
    private_vehicle_ack, decided_at
  ) values (
    p_event_id, p_vehicle_id, v_uid, v_status, trim(p_phone), lower(trim(p_email)),
    nullif(trim(coalesce(p_message, '')), ''), coalesce(p_private_ack, false),
    case when v_status = 'approved' then now() end
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- C) Úprava přihlášky uchazečem (jen čekající / na čekací listině, před začátkem)
-- ---------------------------------------------------------------------
create function public.update_registration(
  p_registration_id uuid,
  p_phone text,
  p_email text,
  p_message text
)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_registrations;
  v_starts timestamptz;
begin
  select * into v_row from public.event_registrations where id = p_registration_id;
  if not found or v_row.user_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if v_row.status not in ('pending', 'waitlist') then raise exception 'not_editable'; end if;
  select starts_at into v_starts from public.events where id = v_row.event_id;
  if now() >= v_starts then raise exception 'event_started'; end if;

  if coalesce(char_length(trim(p_phone)), 0) not between 5 and 30
     or coalesce(trim(p_email), '') not like '%_@_%'
     or char_length(trim(p_email)) > 254
     or char_length(coalesce(p_message, '')) > 1000 then
    raise exception 'contact_invalid';
  end if;

  update public.event_registrations
  set contact_phone = trim(p_phone),
      contact_email = lower(trim(p_email)),
      message = nullif(trim(coalesce(p_message, '')), '')
  where id = p_registration_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.update_registration(uuid, text, text, text) from public, anon;
grant execute on function public.update_registration(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Upozornění: automaticky schválená přihláška = „schváleno“ (ne „přijato“);
-- e-mail o schválení nese informace pro účastníky.
-- ---------------------------------------------------------------------
create or replace function public.registration_status_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_vehicle text;
  v_type public.notification_type;
  v_email boolean := true;
  v_payload jsonb;
begin
  if tg_op = 'UPDATE' and new.status = old.status then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_type := case new.status
      when 'waitlist' then 'registration_waitlist'
      when 'approved' then 'registration_approved'
      else 'registration_received' end;
  elsif new.status = 'approved' then
    v_type := case when old.status = 'waitlist' and new.decided_by is null
                   then 'registration_promoted' else 'registration_approved' end;
  elsif new.status = 'rejected' then
    v_type := 'registration_rejected';
  elsif new.status = 'waitlist' then
    v_type := 'registration_waitlist';
  elsif new.status = 'cancelled' then
    v_type := 'registration_cancelled';
    v_email := false;
  else
    -- návrat k posouzení: bez zprávy
    return new;
  end if;

  select * into v_event from public.events where id = new.event_id;
  select make || ' ' || model into v_vehicle from public.vehicles where id = new.vehicle_id;

  v_payload := jsonb_build_object(
    'event_title', v_event.title,
    'event_slug', v_event.slug,
    'event_starts_at', v_event.starts_at,
    'event_ends_at', v_event.ends_at,
    'event_timezone', v_event.timezone,
    'vehicle', v_vehicle,
    'reason', new.rejection_reason,
    'message', new.decision_message
  );
  if v_type in ('registration_approved', 'registration_promoted') then
    v_payload := v_payload || jsonb_build_object(
      'participant_info',
      (select body from public.event_participant_info where event_id = new.event_id)
    );
  end if;

  perform public.enqueue_user_message(
    new.user_id, v_type, new.event_id, new.id, v_payload, v_email
  );
  return new;
end;
$$;
