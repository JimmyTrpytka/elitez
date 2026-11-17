-- =====================================================================
-- Registrace na srazy – vylepšení, část 3 (SPEC 5.1k, body I a K)
-- I) „Doplň prosím“ – pořadatel požádá o víc fotek / informací
-- K) Vlastní otázky u eventu (text, číslo, ano/ne, výběr z možností)
-- =====================================================================

-- ---------------------------------------------------------------------
-- I) Žádost o doplnění (uchazeč ji vidí ve své přihlášce)
-- ---------------------------------------------------------------------
alter table public.event_registrations
  add column info_request text check (char_length(info_request) <= 1000),
  add column info_requested_at timestamptz,
  add column info_reply text check (char_length(info_reply) <= 1000),
  add column info_replied_at timestamptz;

create function public.request_registration_info(p_registration_id uuid, p_message text)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_registrations;
  v_event public.events;
  v_vehicle text;
begin
  select * into v_row from public.event_registrations where id = p_registration_id;
  if not found or not public.is_event_organizer(v_row.event_id) then
    raise exception 'not_allowed';
  end if;
  if v_row.status not in ('pending', 'waitlist') then raise exception 'not_editable'; end if;
  if coalesce(char_length(trim(p_message)), 0) not between 1 and 1000 then
    raise exception 'message_required';
  end if;

  update public.event_registrations
  set info_request = trim(p_message), info_requested_at = now(),
      info_reply = null, info_replied_at = null
  where id = p_registration_id
  returning * into v_row;

  select * into v_event from public.events where id = v_row.event_id;
  select make || ' ' || model into v_vehicle from public.vehicles where id = v_row.vehicle_id;
  perform public.enqueue_user_message(
    v_row.user_id, 'registration_info_requested', v_row.event_id, v_row.id,
    jsonb_build_object(
      'event_title', v_event.title,
      'event_slug', v_event.slug,
      'event_starts_at', v_event.starts_at,
      'event_ends_at', v_event.ends_at,
      'event_timezone', v_event.timezone,
      'vehicle', v_vehicle,
      'message', v_row.info_request
    ),
    true
  );
  return v_row;
end;
$$;

create function public.reply_registration_info(p_registration_id uuid, p_reply text)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_registrations;
  v_event public.events;
  v_vehicle text;
  v_name text;
begin
  select * into v_row from public.event_registrations where id = p_registration_id;
  if not found or v_row.user_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if v_row.info_requested_at is null or v_row.status not in ('pending', 'waitlist') then
    raise exception 'not_editable';
  end if;
  select * into v_event from public.events where id = v_row.event_id;
  if now() >= v_event.starts_at then raise exception 'event_started'; end if;
  if coalesce(char_length(trim(p_reply)), 0) not between 1 and 1000 then
    raise exception 'message_required';
  end if;

  update public.event_registrations
  set info_reply = trim(p_reply), info_replied_at = now()
  where id = p_registration_id
  returning * into v_row;

  select make || ' ' || model into v_vehicle from public.vehicles where id = v_row.vehicle_id;
  select coalesce(display_name, '@' || username) into v_name from public.profiles where id = v_row.user_id;
  perform public.notify_organizer_managers(
    v_event.organizer_id, 'registration_info_provided', v_event,
    jsonb_build_object(
      'event_title', v_event.title,
      'event_slug', v_event.slug,
      'event_id', v_event.id,
      'registration_id', v_row.id,
      'vehicle', v_vehicle,
      'name', v_name
    )
  );
  return v_row;
end;
$$;

revoke execute on function public.request_registration_info(uuid, text) from public, anon;
revoke execute on function public.reply_registration_info(uuid, text) from public, anon;
grant execute on function public.request_registration_info(uuid, text) to authenticated;
grant execute on function public.reply_registration_info(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- K) Vlastní otázky u eventu
-- ---------------------------------------------------------------------
create type public.event_question_kind as enum ('text', 'number', 'boolean', 'choice');

create table public.event_questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  position smallint not null default 0,
  kind public.event_question_kind not null,
  label text not null check (char_length(label) between 1 and 200),
  options text[],
  required boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    (kind = 'choice' and options is not null and cardinality(options) between 2 and 20)
    or (kind <> 'choice' and options is null)
  )
);

create index event_questions_event_idx on public.event_questions (event_id, position);

alter table public.event_questions enable row level security;

-- Otázky vidí každý, kdo vidí event (RLS eventů se uplatní v poddotazu)
create policy "event questions: read with event"
  on public.event_questions for select
  to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_id));

create policy "event questions: organizer inserts"
  on public.event_questions for insert
  to authenticated
  with check (public.is_event_organizer(event_id));

create policy "event questions: organizer updates"
  on public.event_questions for update
  to authenticated
  using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

create policy "event questions: organizer deletes"
  on public.event_questions for delete
  to authenticated
  using (public.is_event_organizer(event_id));

alter table public.event_registrations
  add column answers jsonb not null default '{}'::jsonb;

-- Kontrola a vyčištění odpovědí: { "<id otázky>": hodnota }.
-- Chyby: answer_required, answers_invalid
create function public.clean_registration_answers(p_event_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q public.event_questions;
  v_val jsonb;
  v_text text;
  v_out jsonb := '{}'::jsonb;
begin
  if p_answers is not null and jsonb_typeof(p_answers) <> 'object' then
    raise exception 'answers_invalid';
  end if;
  for v_q in select * from public.event_questions where event_id = p_event_id order by position loop
    v_val := p_answers -> v_q.id::text;
    if v_val is null or v_val = 'null'::jsonb or (jsonb_typeof(v_val) = 'string' and trim(v_val #>> '{}') = '') then
      if v_q.required then raise exception 'answer_required'; end if;
      continue;
    end if;
    v_text := trim(v_val #>> '{}');
    case v_q.kind
      when 'text' then
        if char_length(v_text) > 500 then raise exception 'answers_invalid'; end if;
        v_out := v_out || jsonb_build_object(v_q.id::text, v_text);
      when 'number' then
        if v_text !~ '^-?\d{1,7}([.,]\d{1,2})?$' then raise exception 'answers_invalid'; end if;
        v_out := v_out || jsonb_build_object(v_q.id::text, replace(v_text, ',', '.')::numeric);
      when 'boolean' then
        if v_text not in ('true', 'false') then raise exception 'answers_invalid'; end if;
        v_out := v_out || jsonb_build_object(v_q.id::text, v_text = 'true');
      when 'choice' then
        if not (v_text = any (v_q.options)) then raise exception 'answers_invalid'; end if;
        v_out := v_out || jsonb_build_object(v_q.id::text, v_text);
    end case;
  end loop;
  return v_out;
end;
$$;

revoke execute on function public.clean_registration_answers(uuid, jsonb) from public, anon, authenticated;

-- Přihlášení s odpověďmi (nový parametr p_answers; bez něj funguje i stará verze aplikace)
drop function public.register_for_event(uuid, uuid, text, text, text, boolean, boolean);

create function public.register_for_event(
  p_event_id uuid,
  p_vehicle_id uuid,
  p_phone text,
  p_email text,
  p_message text,
  p_consent boolean,
  p_private_ack boolean,
  p_answers jsonb default '{}'::jsonb
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
  v_answers jsonb;
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

  v_answers := public.clean_registration_answers(p_event_id, coalesce(p_answers, '{}'::jsonb));

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
    private_vehicle_ack, decided_at, answers
  ) values (
    p_event_id, p_vehicle_id, v_uid, v_status, trim(p_phone), lower(trim(p_email)),
    nullif(trim(coalesce(p_message, '')), ''), coalesce(p_private_ack, false),
    case when v_status = 'approved' then now() end, v_answers
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.register_for_event(uuid, uuid, text, text, text, boolean, boolean, jsonb) from public, anon;
grant execute on function public.register_for_event(uuid, uuid, text, text, text, boolean, boolean, jsonb) to authenticated;
