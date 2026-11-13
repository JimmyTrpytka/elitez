-- =====================================================================
-- CREATOR část 2: přihláška na event jako MÉDIA
-- - Pořadatel u eventu zapne „přijímáme média“ a volitelně limit míst.
-- - Creator pošle žádost (bez auta), pořadatel ji schválí / zamítne.
-- - Schválená média jsou veřejně vidět na stránce eventu.
-- Zápis jen přes funkce níže (security definer).
-- =====================================================================

alter table public.events
  add column media_enabled boolean not null default false,
  add column media_capacity integer check (media_capacity > 0);

create table public.event_media_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  skills text[] not null default '{}'
    check (skills <@ array['photo', 'video', 'drone']::text[]),
  contact_phone text not null check (char_length(contact_phone) between 5 and 30),
  contact_email text not null check (char_length(contact_email) between 3 and 254 and contact_email like '%@%'),
  -- pro koho fotí / točí (magazín, vlastní kanál…)
  message text check (char_length(message) <= 1000),
  decision_message text check (char_length(decision_message) <= 1000),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jeden člověk = nejvýš jedna nezrušená žádost na event
create unique index event_media_requests_one_per_user
  on public.event_media_requests (event_id, user_id)
  where status <> 'cancelled';
create index event_media_requests_event_idx on public.event_media_requests (event_id, status, created_at);
create index event_media_requests_user_idx on public.event_media_requests (user_id);

create trigger event_media_requests_set_updated_at
  before update on public.event_media_requests
  for each row execute function public.set_updated_at();

alter table public.event_media_requests enable row level security;

-- Číst: žadatel své, pořadatel žádosti na své eventy, admin vše
create policy "media requests: read own or as organizer"
  on public.event_media_requests for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_event_organizer(event_id)
    or (select public.is_admin())
  );

revoke insert, update, delete on public.event_media_requests from anon, authenticated;
revoke select on public.event_media_requests from anon;

-- Pořadatel vidí profil žadatele (i soukromý) na svůj event
create policy "profiles: organizer reads media applicants"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.event_media_requests m
      where m.user_id = profiles.id and public.is_event_organizer(m.event_id)
    )
  );

-- ---------------------------------------------------------------------
-- Žádost o akreditaci (Creator)
-- Chyby: not_signed_in, not_creator, username_required, event_unavailable,
-- media_disabled, invite_only, crew_only, registration_closed,
-- consent_required, contact_invalid, already_registered
-- ---------------------------------------------------------------------
create function public.request_media(
  p_event_id uuid,
  p_phone text,
  p_email text,
  p_message text,
  p_skills text[],
  p_consent boolean
)
returns public.event_media_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events;
  v_profile public.profiles;
  v_skills text[];
  v_row public.event_media_requests;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not v_profile.is_creator then raise exception 'not_creator'; end if;
  if v_profile.username is null then raise exception 'username_required'; end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'published' then raise exception 'event_unavailable'; end if;
  if not v_event.media_enabled then raise exception 'media_disabled'; end if;
  if v_event.access = 'invite_only' then raise exception 'invite_only'; end if;
  if v_event.access = 'crew_only' and not public.is_organizer_crew_member(v_event.organizer_id) then
    raise exception 'crew_only';
  end if;
  -- Média se hlásí až do začátku eventu (nezávisle na registraci aut)
  if now() >= v_event.starts_at then raise exception 'registration_closed'; end if;
  if not coalesce(p_consent, false) then raise exception 'consent_required'; end if;

  if coalesce(char_length(trim(p_phone)), 0) not between 5 and 30
     or coalesce(trim(p_email), '') not like '%_@_%'
     or char_length(trim(p_email)) > 254
     or char_length(coalesce(p_message, '')) > 1000 then
    raise exception 'contact_invalid';
  end if;

  select coalesce(array_agg(distinct s), '{}') into v_skills
  from unnest(coalesce(p_skills, '{}'::text[])) s
  where s in ('photo', 'video', 'drone');

  if exists (
    select 1 from public.event_media_requests
    where event_id = p_event_id and user_id = v_uid and status <> 'cancelled'
  ) then
    raise exception 'already_registered';
  end if;

  insert into public.event_media_requests (event_id, user_id, skills, contact_phone, contact_email, message)
  values (
    p_event_id, v_uid, v_skills, trim(p_phone), lower(trim(p_email)),
    nullif(trim(coalesce(p_message, '')), '')
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- Zrušení žadatelem (před začátkem eventu)
create function public.cancel_media_request(p_request_id uuid)
returns public.event_media_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_media_requests;
  v_starts timestamptz;
begin
  select * into v_row from public.event_media_requests where id = p_request_id;
  if not found or v_row.user_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if v_row.status not in ('pending', 'approved') then raise exception 'not_cancellable'; end if;
  select starts_at into v_starts from public.events where id = v_row.event_id;
  if now() >= v_starts then raise exception 'event_started'; end if;

  update public.event_media_requests set status = 'cancelled'
  where id = p_request_id
  returning * into v_row;
  return v_row;
end;
$$;

-- Rozhodnutí pořadatele: approved / rejected / pending (zpět k posouzení)
create function public.decide_media_request(
  p_request_id uuid,
  p_decision text,
  p_message text default null
)
returns public.event_media_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_media_requests;
  v_event public.events;
begin
  select * into v_row from public.event_media_requests where id = p_request_id;
  if not found or not public.is_event_organizer(v_row.event_id) then
    raise exception 'not_allowed';
  end if;
  if p_decision not in ('approved', 'rejected', 'pending') then raise exception 'invalid_decision'; end if;
  if v_row.status = 'cancelled' then raise exception 'cancelled'; end if;
  if char_length(coalesce(p_message, '')) > 1000 then raise exception 'message_too_long'; end if;

  -- Zámek eventu: souběžná schválení nepřekročí limit
  select * into v_event from public.events where id = v_row.event_id for update;
  if p_decision = 'approved' and v_row.status <> 'approved' and v_event.media_capacity is not null and (
    select count(*) from public.event_media_requests
    where event_id = v_row.event_id and status = 'approved'
  ) >= v_event.media_capacity then
    raise exception 'media_full';
  end if;

  update public.event_media_requests
  set status = p_decision,
      decision_message = case when p_decision = 'pending' then null
        else nullif(trim(coalesce(p_message, '')), '') end,
      decided_at = now(),
      decided_by = auth.uid()
  where id = p_request_id
  returning * into v_row;

  if p_decision in ('approved', 'rejected') then
    insert into public.notifications (user_id, type, event_id, payload)
    values (
      v_row.user_id,
      case when p_decision = 'approved' then 'media_approved' else 'media_rejected' end::public.notification_type,
      v_row.event_id,
      jsonb_build_object(
        'event_title', v_event.title,
        'event_slug', v_event.slug,
        'message', v_row.decision_message
      )
    );
  end if;
  return v_row;
end;
$$;

revoke execute on function public.request_media(uuid, text, text, text, text[], boolean) from public, anon;
revoke execute on function public.cancel_media_request(uuid) from public, anon;
revoke execute on function public.decide_media_request(uuid, text, text) from public, anon;
grant execute on function public.request_media(uuid, text, text, text, text[], boolean) to authenticated;
grant execute on function public.cancel_media_request(uuid) to authenticated;
grant execute on function public.decide_media_request(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Veřejný seznam schválených médií (jen veřejné profily, bez kontaktů)
-- a jen u eventu, který čtenář smí vidět
-- ---------------------------------------------------------------------
create function public.event_media_list(p_event_id uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_path text,
  skills text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_path, m.skills
  from public.event_media_requests m
  join public.profiles p on p.id = m.user_id
  join public.events e on e.id = m.event_id
  where m.event_id = p_event_id
    and m.status = 'approved'
    and p.visibility = 'public'
    and (
      (e.status <> 'draft' and e.access in ('public', 'verified_only'))
      or (e.status <> 'draft' and e.access = 'crew_only' and public.is_organizer_crew_member(e.organizer_id))
      or public.is_event_organizer(e.id)
    )
  order by m.decided_at nulls last, m.created_at;
$$;

revoke execute on function public.event_media_list(uuid) from public;
grant execute on function public.event_media_list(uuid) to anon, authenticated;
