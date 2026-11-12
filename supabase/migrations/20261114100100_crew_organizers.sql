-- =====================================================================
-- Milník 5d (část 2): Crew jako pořadatel, srazy jen pro členy crew
-- Pravidla: SPEC.md 5.1g
-- Pořadatel = člověk (profile_id) NEBO crew (crew_id). Crew-pořadatele
-- spravují zakladatel a správci crew. Stávající systém eventů beze změny.
-- =====================================================================

alter table public.organizers
  alter column profile_id drop not null,
  add column crew_id uuid unique references public.crews (id) on delete cascade,
  add constraint organizers_owner check ((profile_id is null) <> (crew_id is null));

alter table public.crews add column organizer_requested_at timestamptz;

-- Pořadatelské účty, které přihlášený spravuje (vlastní + crew, kde je správce)
create or replace function public.my_organizer_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.id from public.organizers o
  where o.status = 'approved'
    and (
      o.profile_id = (select auth.uid())
      or (
        o.crew_id is not null
        and exists (
          select 1 from public.crews c
          join public.crew_members m on m.crew_id = c.id
          where c.id = o.crew_id
            and c.status = 'approved'
            and m.user_id = (select auth.uid())
            and m.status = 'active'
            and m.role in ('founder', 'admin')
        )
      )
    );
$$;

-- Seznam pro přepínač v sekci Pořadatel (vlastní první)
create function public.my_organizers()
returns table (id uuid, name text, slug text, crew_id uuid, crew_slug text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.slug, o.crew_id, c.slug
  from public.organizers o
  left join public.crews c on c.id = o.crew_id
  where o.id in (select public.my_organizer_ids())
  order by (o.crew_id is null) desc, o.name;
$$;

revoke execute on function public.my_organizers() from public, anon;
grant execute on function public.my_organizers() to authenticated;

-- Profil pořadatele smí upravit i správce crew (stav dál jen admin)
drop policy "organizers: owner update profile" on public.organizers;
create policy "organizers: owner update profile"
  on public.organizers for update
  to authenticated
  using (id in (select public.my_organizer_ids()))
  with check (id in (select public.my_organizer_ids()));

drop policy "organizer-logos: upload own" on storage.objects;
create policy "organizer-logos: upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'organizer-logos'
    and (storage.foldername(name))[1] in (select x::text from public.my_organizer_ids() as x)
  );

drop policy "organizer-logos: delete own" on storage.objects;
create policy "organizer-logos: delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'organizer-logos'
    and (storage.foldername(name))[1] in (select x::text from public.my_organizer_ids() as x)
  );

-- ---------------------------------------------------------------------
-- Srazy jen pro členy crew
-- ---------------------------------------------------------------------

-- Je přihlášený (nebo p_user) aktivní člen crew, která pořadatele vlastní?
create function public.is_organizer_crew_member(p_organizer_id uuid, p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizers o
    join public.crew_members m on m.crew_id = o.crew_id
    where o.id = p_organizer_id
      and m.user_id = coalesce(p_user, (select auth.uid()))
      and m.status = 'active'
  );
$$;

drop policy "events: read visible" on public.events;
create policy "events: read visible"
  on public.events for select
  to anon, authenticated
  using (
    (status <> 'draft' and access in ('public', 'verified_only'))
    or (status <> 'draft' and access = 'crew_only' and (select public.is_organizer_crew_member(organizer_id)))
    or organizer_id in (select public.my_organizer_ids())
    or (select public.is_admin())
  );

-- „Jen pro členy crew“ smí mít jen pořadatel, který je crew
create function public.events_check_crew_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.access = 'crew_only' and not exists (
    select 1 from public.organizers where id = new.organizer_id and crew_id is not null
  ) then
    raise exception 'crew_only_requires_crew';
  end if;
  return new;
end;
$$;

create trigger events_check_crew_only
  before insert or update of access, organizer_id on public.events
  for each row execute function public.events_check_crew_only();

-- Přihlásit se na sraz jen pro členy smí jen člen (pojistka pro všechny cesty zápisu)
create function public.registrations_check_crew_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
begin
  select * into v_event from public.events where id = new.event_id;
  if v_event.access = 'crew_only'
     and not public.is_organizer_crew_member(v_event.organizer_id, new.user_id) then
    raise exception 'crew_only';
  end if;
  return new;
end;
$$;

create trigger event_registrations_check_crew_only
  before insert on public.event_registrations
  for each row execute function public.registrations_check_crew_only();

-- ---------------------------------------------------------------------
-- Komu jdou upozornění na event:
--   sledující pořadatele (veřejné a „jen Verified“ eventy)
--   + aktivní členové crew-pořadatele (kromě správců, kteří event dělají)
-- ---------------------------------------------------------------------
create function public.event_audience(p_event public.events)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select f.follower_id
  from public.organizer_follows f
  where f.organizer_id = p_event.organizer_id
    and p_event.access in ('public', 'verified_only')
  union
  select m.user_id
  from public.organizers o
  join public.crew_members m on m.crew_id = o.crew_id
  where o.id = p_event.organizer_id
    and m.status = 'active'
    and m.role = 'member'
    and p_event.access <> 'invite_only';
$$;

revoke execute on function public.event_audience(public.events) from public, anon, authenticated;

create or replace function public.schedule_registration_open(p_event public.events, p_user uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := public.organizer_event_payload(p_event);
begin
  if p_event.status <> 'published' or p_event.access = 'invite_only' then
    return;
  end if;

  insert into public.notifications (user_id, type, event_id, payload, visible_from, created_at)
  select
    a.user_id,
    'organizer_registration_open',
    p_event.id,
    v_payload,
    t.at,
    t.at
  from public.event_audience(p_event) a(user_id)
  join public.profiles p on p.id = a.user_id
  cross join lateral (
    select case
      when p.verified_at is not null then coalesce(p_event.registration_verified_opens_at, p_event.registration_opens_at)
      when p_event.access in ('public', 'crew_only') then p_event.registration_opens_at
      else null
    end as at
  ) t
  where (p_user is null or a.user_id = p_user)
    and t.at is not null
    and t.at > now()
    and (p_event.registration_closes_at is null or t.at < p_event.registration_closes_at);
end;
$$;

create or replace function public.organizer_event_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was_published boolean := tg_op = 'UPDATE' and old.status = 'published';
begin
  -- Eventy na pozvánky se nepozvaným neukazují (pozvánky přijdou v Milníku 6)
  if new.access = 'invite_only' then
    if v_was_published then
      perform public.unschedule_registration_open(new.id);
    end if;
    return new;
  end if;

  -- Zveřejnění
  if new.status = 'published' and (tg_op = 'INSERT' or old.status = 'draft') then
    insert into public.notifications (user_id, type, event_id, payload)
    select a.user_id, 'organizer_event_published', new.id, public.organizer_event_payload(new)
    from public.event_audience(new) a(user_id);
    perform public.schedule_registration_open(new);
    return new;
  end if;

  if not v_was_published then
    return new;
  end if;

  -- Stále zveřejněný, ale změnil se čas registrace nebo přístup → přeplánovat
  if new.status = 'published' then
    if new.registration_opens_at is distinct from old.registration_opens_at
       or new.registration_verified_opens_at is distinct from old.registration_verified_opens_at
       or new.registration_closes_at is distinct from old.registration_closes_at
       or new.access is distinct from old.access then
      perform public.unschedule_registration_open(new.id);
      perform public.schedule_registration_open(new);
    end if;
    return new;
  end if;

  -- Už není zveřejněný (uzavřený, zrušený, vrácený do konceptu)
  perform public.unschedule_registration_open(new.id);
  if new.status = 'cancelled' then
    insert into public.notifications (user_id, type, event_id, payload)
    select a.user_id, 'organizer_event_cancelled', new.id, public.organizer_event_payload(new)
    from public.event_audience(new) a(user_id);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Žádost crew o pořádání a schválení adminem
-- ---------------------------------------------------------------------
create function public.request_crew_organizer(p_crew_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_crew public.crews;
begin
  if not public.is_crew_manager(p_crew_id) then
    raise exception 'not_allowed';
  end if;
  select * into v_crew from public.crews where id = p_crew_id and status = 'approved';
  if not found then
    raise exception 'not_found';
  end if;
  if exists (select 1 from public.organizers where crew_id = p_crew_id) then
    raise exception 'already_organizer';
  end if;
  if v_crew.organizer_requested_at is not null then
    return;
  end if;
  update public.crews set organizer_requested_at = now() where id = p_crew_id;
  insert into public.notifications (user_id, type, payload)
  select p.id, 'crew_organizer_request', jsonb_build_object('crew_name', v_crew.name, 'crew_slug', v_crew.slug)
  from public.profiles p where p.role = 'admin';
end;
$$;

revoke execute on function public.request_crew_organizer(uuid) from public, anon;
grant execute on function public.request_crew_organizer(uuid) to authenticated;

create function public.admin_set_crew_organizer(p_crew_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_crew public.crews;
  v_existed boolean;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  select * into v_crew from public.crews where id = p_crew_id;
  if not found then
    raise exception 'not_found';
  end if;

  if p_enabled then
    if v_crew.status <> 'approved' then
      raise exception 'crew_not_approved';
    end if;
    v_existed := exists (select 1 from public.organizers where crew_id = p_crew_id and status = 'approved');
    insert into public.organizers (crew_id, name, description, status)
    values (p_crew_id, left(v_crew.name, 80), v_crew.description, 'approved')
    on conflict (crew_id) do update set status = 'approved';
    update public.crews set organizer_requested_at = null where id = p_crew_id;
    if not v_existed then
      insert into public.notifications (user_id, type, payload)
      values (v_crew.founder_id, 'crew_organizer_approved',
              jsonb_build_object('crew_name', v_crew.name, 'crew_slug', v_crew.slug));
    end if;
  else
    update public.organizers set status = 'suspended' where crew_id = p_crew_id;
    update public.crews set organizer_requested_at = null where id = p_crew_id;
  end if;
end;
$$;

revoke execute on function public.admin_set_crew_organizer(uuid, boolean) from public, anon;
grant execute on function public.admin_set_crew_organizer(uuid, boolean) to authenticated;

-- Admin seznam crew: navíc žádost o pořádání a stav pořadatele
drop function public.admin_list_crews(public.crew_status);
create function public.admin_list_crews(p_status public.crew_status default null)
returns table (
  id uuid,
  slug text,
  name text,
  focus text,
  description text,
  status public.crew_status,
  join_policy public.crew_join_policy,
  founder_username text,
  founder_name text,
  members integer,
  created_at timestamptz,
  organizer_requested_at timestamptz,
  organizer_status public.organizer_status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  return query
  select c.id, c.slug, c.name, c.focus, c.description, c.status, c.join_policy,
         p.username, p.display_name,
         (select count(*)::integer from public.crew_members m where m.crew_id = c.id and m.status = 'active'),
         c.created_at,
         c.organizer_requested_at,
         (select o.status from public.organizers o where o.crew_id = c.id)
  from public.crews c
  join public.profiles p on p.id = c.founder_id
  where p_status is null or c.status = p_status
  order by (c.status = 'pending') desc, (c.organizer_requested_at is not null) desc, c.created_at desc
  limit 200;
end;
$$;

revoke execute on function public.admin_list_crews(public.crew_status) from public, anon;
grant execute on function public.admin_list_crews(public.crew_status) to authenticated;
