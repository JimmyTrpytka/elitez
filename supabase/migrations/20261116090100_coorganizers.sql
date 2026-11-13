-- =====================================================================
-- Spolupořadatelé a správci crew (připomínka testerů)
-- - Vlastník pořadatele (člověk, u crew zakladatel/správci) přidává
--   spolupořadatele podle uživatelského jména. Spolupořadatel spravuje
--   eventy (stejně jako vlastník), ale další lidi přidávat nemůže.
-- - Zakladatel crew jmenuje správce crew (role admin).
-- Zápis jen přes funkce níže.
-- =====================================================================

create table public.organizer_members (
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organizer_id, user_id)
);

create index organizer_members_user_idx on public.organizer_members (user_id);

alter table public.organizer_members enable row level security;
revoke insert, update, delete on public.organizer_members from anon, authenticated;

-- Je přihlášený vlastník pořadatele? (člověk-pořadatel, správce crew-pořadatele, admin)
create function public.is_organizer_owner(p_organizer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.organizers o
    where o.id = p_organizer_id
      and o.status = 'approved'
      and (
        o.profile_id = (select auth.uid())
        or (o.crew_id is not null and public.is_crew_manager(o.crew_id))
      )
  );
$$;

-- Číst: své členství a vlastník pořadatele
create policy "organizer_members: read own or owner"
  on public.organizer_members for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_organizer_owner(organizer_id)));

-- Spravované pořadatelské účty: navíc ty, kde je uživatel spolupořadatel
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
      or exists (
        select 1 from public.organizer_members om
        where om.organizer_id = o.id and om.user_id = (select auth.uid())
      )
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

-- Přidat spolupořadatele podle uživatelského jména
create function public.add_organizer_member(p_organizer_id uuid, p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.profiles;
  v_org public.organizers;
begin
  if not public.is_organizer_owner(p_organizer_id) then
    raise exception 'not_allowed';
  end if;
  select * into v_org from public.organizers where id = p_organizer_id;
  select * into v_user from public.profiles where username = lower(btrim(coalesce(p_username, '')));
  if not found then
    raise exception 'user_not_found';
  end if;
  if v_user.id = v_org.profile_id then
    raise exception 'already_member';
  end if;
  if (select count(*) from public.organizer_members where organizer_id = p_organizer_id) >= 20 then
    raise exception 'member_limit';
  end if;
  insert into public.organizer_members (organizer_id, user_id, added_by)
  values (p_organizer_id, v_user.id, auth.uid())
  on conflict do nothing;
  if found then
    insert into public.notifications (user_id, type, payload)
    values (v_user.id, 'organizer_member_added',
            jsonb_build_object('organizer_name', v_org.name, 'organizer_slug', v_org.slug));
  end if;
end;
$$;

revoke execute on function public.add_organizer_member(uuid, text) from public, anon;
grant execute on function public.add_organizer_member(uuid, text) to authenticated;

-- Odebrat spolupořadatele (vlastník), nebo sám odejít
create function public.remove_organizer_member(p_organizer_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_organizer_owner(p_organizer_id) and p_user_id <> auth.uid() then
    raise exception 'not_allowed';
  end if;
  delete from public.organizer_members where organizer_id = p_organizer_id and user_id = p_user_id;
end;
$$;

revoke execute on function public.remove_organizer_member(uuid, uuid) from public, anon;
grant execute on function public.remove_organizer_member(uuid, uuid) to authenticated;

-- Seznam spolupořadatelů (pro vlastníka a samotné spolupořadatele)
create function public.organizer_member_list(p_organizer_id uuid)
returns table (user_id uuid, username text, display_name text, avatar_path text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_path, om.created_at
  from public.organizer_members om
  join public.profiles p on p.id = om.user_id
  where om.organizer_id = p_organizer_id
    and p_organizer_id in (select public.my_organizer_ids())
  order by om.created_at;
$$;

revoke execute on function public.organizer_member_list(uuid) from public, anon;
grant execute on function public.organizer_member_list(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Správci crew: jmenuje a odvolává jen zakladatel (nebo admin klubu)
-- ---------------------------------------------------------------------
create function public.set_crew_member_role(p_crew_id uuid, p_user_id uuid, p_role public.crew_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.crew_members;
  v_crew public.crews;
begin
  if p_role not in ('admin', 'member') then
    raise exception 'invalid_role';
  end if;
  select * into v_crew from public.crews where id = p_crew_id;
  if not found then
    raise exception 'not_found';
  end if;
  if v_crew.founder_id <> auth.uid() and not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  select * into v_member from public.crew_members where crew_id = p_crew_id and user_id = p_user_id;
  if not found or v_member.status <> 'active' then
    raise exception 'not_member';
  end if;
  if v_member.role = 'founder' then
    raise exception 'not_allowed';
  end if;
  update public.crew_members set role = p_role where crew_id = p_crew_id and user_id = p_user_id;
  if p_role = 'admin' and v_member.role <> 'admin' then
    insert into public.notifications (user_id, type, payload)
    values (p_user_id, 'crew_admin_added', jsonb_build_object('crew_name', v_crew.name, 'crew_slug', v_crew.slug));
  end if;
end;
$$;

revoke execute on function public.set_crew_member_role(uuid, uuid, public.crew_role) from public, anon;
grant execute on function public.set_crew_member_role(uuid, uuid, public.crew_role) to authenticated;
