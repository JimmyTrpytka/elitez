-- =====================================================================
-- Spolupořádání eventu více pořadateli (např. Sníženo.cz × crew Lower United)
-- - Spolupořadatel se u eventu jen ukazuje: event je i na jeho profilu,
--   na stránce eventu „Pořádají: …“, jeho sledující a členové crew dostanou
--   upozornění. Spravovat event dál smí jen hlavní pořadatel.
-- - Začít může kterákoli strana (žádost spolupořadatele / pozvánka hlavního),
--   druhá strana vždy potvrdí.
-- - Jen zveřejněné eventy s přístupem public / verified_only.
-- Zápis jen přes funkce níže.
-- =====================================================================

create table public.event_cohosts (
  event_id uuid not null references public.events (id) on delete cascade,
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  -- true = pozval hlavní pořadatel (potvrzuje spolupořadatel),
  -- false = požádal spolupořadatel (potvrzuje hlavní pořadatel)
  invited_by_host boolean not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (event_id, organizer_id)
);

create index event_cohosts_organizer_idx on public.event_cohosts (organizer_id, status);

alter table public.event_cohosts enable row level security;

-- Číst: potvrzené u eventu, který čtenář vidí; nepotvrzené jen obě strany
create policy "event_cohosts: read accepted or involved"
  on public.event_cohosts for select
  to anon, authenticated
  using (
    (status = 'accepted' and exists (select 1 from public.events e where e.id = event_cohosts.event_id))
    or public.is_event_organizer(event_id)
    or organizer_id in (select public.my_organizer_ids())
  );

revoke insert, update, delete on public.event_cohosts from anon, authenticated;

-- Kdo za pořadatele dostává upozornění (vlastník, spolupořadatelé-lidé, správci crew)
create function public.organizer_manager_ids(p_organizer_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.profile_id from public.organizers o
  where o.id = p_organizer_id and o.profile_id is not null
  union
  select om.user_id from public.organizer_members om where om.organizer_id = p_organizer_id
  union
  select m.user_id
  from public.organizers o
  join public.crew_members m on m.crew_id = o.crew_id
  where o.id = p_organizer_id and m.status = 'active' and m.role in ('founder', 'admin');
$$;

revoke execute on function public.organizer_manager_ids(uuid) from public, anon, authenticated;

-- Upozornění oběma stranám (bez toho, kdo akci právě udělal)
create function public.notify_organizer_managers(
  p_organizer_id uuid,
  p_type public.notification_type,
  p_event public.events,
  p_payload jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, event_id, payload)
  select m, p_type, p_event.id, p_payload
  from public.organizer_manager_ids(p_organizer_id) m
  where m is distinct from auth.uid();
$$;

revoke execute on function public.notify_organizer_managers(uuid, public.notification_type, public.events, jsonb)
  from public, anon, authenticated;

-- Po potvrzení: sledující spolupořadatele a členové jeho crew se dozví o eventu
-- (kdo už upozornění na tento event má, druhé nedostane)
create function public.notify_cohost_audience(p_event public.events, p_organizer_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, event_id, payload)
  select a.user_id, 'organizer_event_published', p_event.id,
         public.organizer_event_payload(p_event) || jsonb_build_object(
           'organizer_name', o.name, 'organizer_slug', o.slug)
  from (
    select f.follower_id as user_id from public.organizer_follows f where f.organizer_id = p_organizer_id
    union
    select m.user_id
    from public.organizers oo
    join public.crew_members m on m.crew_id = oo.crew_id
    where oo.id = p_organizer_id and m.status = 'active'
  ) a
  cross join public.organizers o
  where o.id = p_organizer_id
    and p_event.status = 'published'
    and p_event.ends_at > now()
    and not exists (
      select 1 from public.notifications n
      where n.user_id = a.user_id and n.event_id = p_event.id and n.type = 'organizer_event_published'
    );
$$;

revoke execute on function public.notify_cohost_audience(public.events, uuid) from public, anon, authenticated;

create function public.cohost_payload(p_event public.events, p_organizer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.organizer_event_payload(p_event) || jsonb_build_object(
    'cohost_name', o.name, 'cohost_slug', o.slug, 'event_id', p_event.id)
  from public.organizers o where o.id = p_organizer_id;
$$;

revoke execute on function public.cohost_payload(public.events, uuid) from public, anon, authenticated;

-- Společné kontroly eventu
create function public.cohost_check_event(p_event public.events, p_organizer_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_event.id is null or p_event.status <> 'published' or p_event.access not in ('public', 'verified_only') then
    raise exception 'event_unavailable';
  end if;
  if p_event.organizer_id = p_organizer_id then raise exception 'own_event'; end if;
  if not exists (select 1 from public.organizers o where o.id = p_organizer_id and o.status = 'approved') then
    raise exception 'organizer_unavailable';
  end if;
  if (select count(*) from public.event_cohosts where event_id = p_event.id and status <> 'declined') >= 10 then
    raise exception 'cohost_limit';
  end if;
end;
$$;

revoke execute on function public.cohost_check_event(public.events, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Spolupořadatel žádá (za pořadatele, kterého spravuje)
-- ---------------------------------------------------------------------
create function public.request_event_cohost(p_event_id uuid, p_organizer_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_row public.event_cohosts;
begin
  if p_organizer_id not in (select public.my_organizer_ids()) then raise exception 'not_allowed'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  perform public.cohost_check_event(v_event, p_organizer_id);

  select * into v_row from public.event_cohosts where event_id = p_event_id and organizer_id = p_organizer_id;
  if found and v_row.status = 'accepted' then raise exception 'already_cohost'; end if;
  if found and v_row.status = 'pending' and v_row.invited_by_host then
    -- hlavní pořadatel už pozval → žádost = přijetí pozvánky
    update public.event_cohosts set status = 'accepted', decided_at = now()
    where event_id = p_event_id and organizer_id = p_organizer_id;
    perform public.notify_organizer_managers(v_event.organizer_id, 'cohost_accepted', v_event,
      public.cohost_payload(v_event, p_organizer_id));
    perform public.notify_cohost_audience(v_event, p_organizer_id);
    return 'accepted';
  end if;
  if found and v_row.status = 'pending' then raise exception 'already_requested'; end if;

  insert into public.event_cohosts (event_id, organizer_id, status, invited_by_host, created_by)
  values (p_event_id, p_organizer_id, 'pending', false, auth.uid())
  on conflict (event_id, organizer_id) do update
    set status = 'pending', invited_by_host = false, created_by = auth.uid(),
        created_at = now(), decided_at = null;
  perform public.notify_organizer_managers(v_event.organizer_id, 'cohost_request', v_event,
    public.cohost_payload(v_event, p_organizer_id));
  return 'pending';
end;
$$;

-- ---------------------------------------------------------------------
-- Hlavní pořadatel zve (podle adresy pořadatele /o/<slug>)
-- ---------------------------------------------------------------------
create function public.invite_event_cohost(p_event_id uuid, p_organizer_slug text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_org uuid;
  v_row public.event_cohosts;
begin
  if not public.is_event_organizer(p_event_id) then raise exception 'not_allowed'; end if;
  select id into v_org from public.organizers
  where slug = lower(btrim(coalesce(p_organizer_slug, ''))) and status = 'approved';
  if v_org is null then raise exception 'organizer_unavailable'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  perform public.cohost_check_event(v_event, v_org);

  select * into v_row from public.event_cohosts where event_id = p_event_id and organizer_id = v_org;
  if found and v_row.status = 'accepted' then raise exception 'already_cohost'; end if;
  if found and v_row.status = 'pending' and not v_row.invited_by_host then
    -- spolupořadatel už požádal → pozvánka = schválení žádosti
    update public.event_cohosts set status = 'accepted', decided_at = now()
    where event_id = p_event_id and organizer_id = v_org;
    perform public.notify_organizer_managers(v_org, 'cohost_accepted', v_event,
      public.cohost_payload(v_event, v_org));
    perform public.notify_cohost_audience(v_event, v_org);
    return 'accepted';
  end if;
  if found and v_row.status = 'pending' then raise exception 'already_requested'; end if;

  insert into public.event_cohosts (event_id, organizer_id, status, invited_by_host, created_by)
  values (p_event_id, v_org, 'pending', true, auth.uid())
  on conflict (event_id, organizer_id) do update
    set status = 'pending', invited_by_host = true, created_by = auth.uid(),
        created_at = now(), decided_at = null;
  perform public.notify_organizer_managers(v_org, 'cohost_invite', v_event,
    public.cohost_payload(v_event, v_org));
  return 'pending';
end;
$$;

-- ---------------------------------------------------------------------
-- Potvrzení / odmítnutí druhou stranou
-- ---------------------------------------------------------------------
create function public.decide_event_cohost(p_event_id uuid, p_organizer_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_cohosts;
  v_event public.events;
begin
  select * into v_row from public.event_cohosts
  where event_id = p_event_id and organizer_id = p_organizer_id for update;
  if not found or v_row.status <> 'pending' then raise exception 'not_pending'; end if;
  -- potvrzuje vždy ta strana, která nezačala
  if v_row.invited_by_host then
    if p_organizer_id not in (select public.my_organizer_ids()) then raise exception 'not_allowed'; end if;
  else
    if not public.is_event_organizer(p_event_id) then raise exception 'not_allowed'; end if;
  end if;

  select * into v_event from public.events where id = p_event_id;
  update public.event_cohosts
  set status = case when p_accept then 'accepted' else 'declined' end, decided_at = now()
  where event_id = p_event_id and organizer_id = p_organizer_id;

  if p_accept then
    perform public.notify_organizer_managers(
      case when v_row.invited_by_host then v_event.organizer_id else p_organizer_id end,
      'cohost_accepted', v_event, public.cohost_payload(v_event, p_organizer_id));
    perform public.notify_cohost_audience(v_event, p_organizer_id);
  end if;
end;
$$;

-- Ukončení spolupořádání: hlavní pořadatel i spolupořadatel
create function public.remove_event_cohost(p_event_id uuid, p_organizer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_event_organizer(p_event_id)
     and p_organizer_id not in (select public.my_organizer_ids()) then
    raise exception 'not_allowed';
  end if;
  delete from public.event_cohosts where event_id = p_event_id and organizer_id = p_organizer_id;
end;
$$;

revoke execute on function public.request_event_cohost(uuid, uuid) from public, anon;
revoke execute on function public.invite_event_cohost(uuid, text) from public, anon;
revoke execute on function public.decide_event_cohost(uuid, uuid, boolean) from public, anon;
revoke execute on function public.remove_event_cohost(uuid, uuid) from public, anon;
grant execute on function public.request_event_cohost(uuid, uuid) to authenticated;
grant execute on function public.invite_event_cohost(uuid, text) to authenticated;
grant execute on function public.decide_event_cohost(uuid, uuid, boolean) to authenticated;
grant execute on function public.remove_event_cohost(uuid, uuid) to authenticated;
