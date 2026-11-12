-- =====================================================================
-- Milník 5d (část 1): Crew – skupiny členů
-- Pravidla: SPEC.md 5.1g
--
-- Do crews (stav, název) a crew_members aplikace NEZAPISUJE přímo – vše jde
-- přes funkce (create_crew, join_crew, leave_crew, decide_crew_member,
-- set_home_crew, admin_review_crew…). Zakladatel smí měnit jen popis,
-- zaměření, vstup a obrázky.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Verified uděluje admin (do Milníku 6 ručně v Admin → Uživatelé)
-- ---------------------------------------------------------------------
create function public.admin_set_verified(p_user_id uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  update public.profiles
  set verified_at = case when p_verified then coalesce(verified_at, now()) else null end
  where id = p_user_id;
end;
$$;

revoke execute on function public.admin_set_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Crew
-- ---------------------------------------------------------------------
create type public.crew_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.crew_join_policy as enum ('open', 'approval');
create type public.crew_role as enum ('founder', 'admin', 'member');
create type public.crew_member_status as enum ('pending', 'active');

-- Klíč pro unikátnost názvu: bez diakritiky, velikosti písmen, mezer a znaků
create function public.crew_name_key(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(public.slugify(p_name), '-', '');
$$;

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(name) between 3 and 60),
  name_key text not null,
  description text check (char_length(description) <= 2000),
  -- zaměření, např. „Audi RS · Praha“
  focus text check (char_length(focus) <= 80),
  join_policy public.crew_join_policy not null default 'approval',
  status public.crew_status not null default 'pending',
  rejection_reason text check (char_length(rejection_reason) <= 500),
  founder_id uuid not null references public.profiles (id) on delete cascade,
  logo_key uuid,
  logo_format text check (logo_format in ('webp', 'jpg')),
  cover_key uuid,
  cover_format text check (cover_format in ('webp', 'jpg')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crews_logo check ((logo_key is null) = (logo_format is null)),
  constraint crews_cover check ((cover_key is null) = (cover_format is null)),
  constraint crews_name_key check (name_key <> '')
);

-- Dvě crew nesmí mít stejný název (zamítnuté název uvolní)
create unique index crews_name_key_unique on public.crews (name_key) where status <> 'rejected';
create index crews_status_idx on public.crews (status);
create index crews_founder_idx on public.crews (founder_id);

create trigger crews_set_updated_at
  before update on public.crews
  for each row execute function public.set_updated_at();

create table public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.crew_role not null default 'member',
  status public.crew_member_status not null default 'active',
  -- domovská crew (nejvýš jedna na člověka) – ukáže se na profilu
  is_home boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

create unique index crew_members_one_home on public.crew_members (user_id) where is_home;
create index crew_members_user_idx on public.crew_members (user_id);
create index crew_members_active_idx on public.crew_members (crew_id) where status = 'active';

-- Smí přihlášený spravovat crew? (zakladatel / správce, aktivní)
create function public.is_crew_manager(p_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.crew_members m
    where m.crew_id = p_crew_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('founder', 'admin')
  );
$$;

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;

-- Číst: schválené všichni; zakladatel svou (i čekající/zamítnutou); admin vše
create policy "crews: read approved, own or admin"
  on public.crews for select
  to anon, authenticated
  using (
    status = 'approved'
    or founder_id = (select auth.uid())
    or (select public.is_admin())
  );

-- Upravit: jen správce crew (sloupce omezené právy níže)
create policy "crews: managers update profile"
  on public.crews for update
  to authenticated
  using ((select public.is_crew_manager(id)))
  with check ((select public.is_crew_manager(id)));

revoke insert, update, delete on public.crews from anon, authenticated;
grant update (description, focus, join_policy, logo_key, logo_format, cover_key, cover_format)
  on public.crews to authenticated;

-- Členství: své řádky, správci své crew, admin
create policy "crew_members: read own, managers, admin"
  on public.crew_members for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_crew_manager(crew_id))
    or (select public.is_admin())
  );

revoke insert, update, delete on public.crew_members from anon, authenticated;

-- ---------------------------------------------------------------------
-- Odznaky crew (pro celou skupinu) + odznak Zakladatel crew (pro člověka)
-- ---------------------------------------------------------------------
alter table public.badges drop constraint badges_category_check;
alter table public.badges add constraint badges_category_check check (category in (
  'turbo_received', 'turbo_given', 'streak', 'discoverer',
  'community', 'event', 'challenge', 'manual', 'crew'
));

create table public.crew_badges (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews (id) on delete cascade,
  badge_code text not null references public.badges (code) on update cascade,
  context_key text not null default '' check (char_length(context_key) <= 80),
  awarded_at timestamptz not null default now(),
  unique (crew_id, badge_code, context_key)
);

alter table public.crew_badges enable row level security;

create policy "crew_badges: read if crew visible"
  on public.crew_badges for select
  to anon, authenticated
  using (exists (select 1 from public.crews c where c.id = crew_id));

revoke insert, update, delete on public.crew_badges from anon, authenticated;

insert into public.badges
  (code, category, icon, rarity, is_unique, threshold, sort, name_cs, name_en, description_cs, description_en)
values
  ('crew_founder', 'community', 'flag', 'rare', false, null, 55,
   'Zakladatel crew', 'Crew founder',
   'Založil(a) crew, kterou klub schválil.', 'Founded a crew approved by the club.'),
  ('crew_10', 'crew', 'crew', 'common', false, 10, 70,
   '10 členů', '10 members', 'Crew má 10 členů.', 'The crew has 10 members.'),
  ('crew_50', 'crew', 'crew', 'rare', false, 50, 71,
   '50 členů', '50 members', 'Crew má 50 členů.', 'The crew has 50 members.'),
  ('crew_100', 'crew', 'crew', 'epic', false, 100, 72,
   '100 členů', '100 members', 'Crew má 100 členů.', 'The crew has 100 members.'),
  ('crew_of_month', 'manual', 'trophy', 'legendary', false, null, 73,
   'Crew měsíce', 'Crew of the month',
   'Ocenění klubu ELITEZ pro nejaktivnější crew měsíce.', 'ELITEZ club award for the most active crew of the month.');

-- Udělí odznak crew (interní); vrací true, když se opravdu udělil
create function public.award_crew_badge(p_crew_id uuid, p_code text, p_context text default '')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.badges where code = p_code and active) then
    return false;
  end if;
  insert into public.crew_badges (crew_id, badge_code, context_key)
  values (p_crew_id, p_code, coalesce(p_context, ''))
  on conflict (crew_id, badge_code, context_key) do nothing
  returning id into v_id;
  return v_id is not null;
end;
$$;

revoke execute on function public.award_crew_badge(uuid, text, text) from public, anon, authenticated;

create function public.admin_award_crew_badge(p_crew_id uuid, p_code text, p_context text default '')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  return public.award_crew_badge(p_crew_id, p_code, p_context);
end;
$$;

revoke execute on function public.admin_award_crew_badge(uuid, text, text) from public, anon;
grant execute on function public.admin_award_crew_badge(uuid, text, text) to authenticated;

-- Po změně členství: odznaky crew podle počtu aktivních členů
create function public.crew_members_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_code text;
begin
  if new.status <> 'active' then
    return new;
  end if;
  select count(*) into v_count
  from public.crew_members where crew_id = new.crew_id and status = 'active';
  for v_code in
    select code from public.badges
    where category = 'crew' and active and threshold is not null and threshold <= v_count
  loop
    perform public.award_crew_badge(new.crew_id, v_code);
  end loop;
  return new;
end;
$$;

create trigger crew_members_after_change
  after insert or update of status on public.crew_members
  for each row execute function public.crew_members_after_change();

-- ---------------------------------------------------------------------
-- Založení a schválení crew
-- ---------------------------------------------------------------------
create function public.create_crew(
  p_name text,
  p_description text default null,
  p_focus text default null,
  p_join_policy public.crew_join_policy default 'approval'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_key text;
  v_slug text;
  v_id uuid := gen_random_uuid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.username is null then
    raise exception 'username_required';
  end if;
  if v_profile.verified_at is null then
    raise exception 'verified_required';
  end if;
  if char_length(v_name) < 3 or char_length(v_name) > 60 then
    raise exception 'name_invalid';
  end if;
  v_key := public.crew_name_key(v_name);
  if v_key = '' then
    raise exception 'name_invalid';
  end if;
  if exists (select 1 from public.crews where founder_id = v_uid and status = 'pending') then
    raise exception 'pending_exists';
  end if;
  if (select count(*) from public.crews where founder_id = v_uid and status in ('pending', 'approved', 'suspended')) >= 3 then
    raise exception 'crew_limit';
  end if;

  -- zámek na název, aby dvě stejné crew nevznikly současně
  perform pg_advisory_xact_lock(hashtext('crew:' || v_key));
  if exists (select 1 from public.crews where name_key = v_key and status <> 'rejected') then
    raise exception 'name_taken';
  end if;

  v_slug := left(public.slugify(v_name), 50);
  if exists (select 1 from public.crews where slug = v_slug) then
    v_slug := v_slug || '-' || left(v_id::text, 4);
  end if;

  insert into public.crews (id, slug, name, name_key, description, focus, join_policy, founder_id)
  values (
    v_id, v_slug, v_name, v_key,
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_focus, '')), ''),
    coalesce(p_join_policy, 'approval'),
    v_uid
  );
  insert into public.crew_members (crew_id, user_id, role, status)
  values (v_id, v_uid, 'founder', 'active');

  -- upozornění adminům ke schválení
  insert into public.notifications (user_id, type, payload)
  select p.id, 'crew_review', jsonb_build_object('crew_id', v_id, 'crew_name', v_name, 'username', v_profile.username)
  from public.profiles p where p.role = 'admin';

  return v_id;
end;
$$;

revoke execute on function public.create_crew(text, text, text, public.crew_join_policy) from public, anon;
grant execute on function public.create_crew(text, text, text, public.crew_join_policy) to authenticated;

-- Admin: schválit / zamítnout (s důvodem) / pozastavit / obnovit
create function public.admin_set_crew_status(
  p_crew_id uuid,
  p_status public.crew_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_crew public.crews;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  select * into v_crew from public.crews where id = p_crew_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if p_status = 'approved' and v_crew.status <> 'rejected'
     and exists (select 1 from public.crews where name_key = v_crew.name_key and id <> v_crew.id and status <> 'rejected') then
    raise exception 'name_taken';
  end if;

  update public.crews
  set status = p_status,
      rejection_reason = case when p_status = 'rejected' then nullif(btrim(coalesce(p_reason, '')), '') else null end,
      approved_at = case when p_status = 'approved' then coalesce(approved_at, now()) else approved_at end
  where id = p_crew_id;

  if p_status = 'approved' and v_crew.status = 'pending' then
    insert into public.notifications (user_id, type, payload)
    values (v_crew.founder_id, 'crew_approved', jsonb_build_object('crew_name', v_crew.name, 'crew_slug', v_crew.slug));
    perform public.award_badge(v_crew.founder_id, 'crew_founder');
    -- domovská crew zakladatele, pokud ještě žádnou nemá
    if not exists (select 1 from public.crew_members where user_id = v_crew.founder_id and is_home) then
      update public.crew_members set is_home = true
      where crew_id = v_crew.id and user_id = v_crew.founder_id;
    end if;
  elsif p_status = 'rejected' and v_crew.status = 'pending' then
    insert into public.notifications (user_id, type, payload)
    values (v_crew.founder_id, 'crew_rejected', jsonb_build_object(
      'crew_name', v_crew.name, 'reason', nullif(btrim(coalesce(p_reason, '')), '')));
  end if;
end;
$$;

revoke execute on function public.admin_set_crew_status(uuid, public.crew_status, text) from public, anon;
grant execute on function public.admin_set_crew_status(uuid, public.crew_status, text) to authenticated;

-- Admin: crew ke schválení / všechny (se zakladatelem – i soukromý profil)
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
  created_at timestamptz
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
         c.created_at
  from public.crews c
  join public.profiles p on p.id = c.founder_id
  where p_status is null or c.status = p_status
  order by (c.status = 'pending') desc, c.created_at desc
  limit 200;
end;
$$;

revoke execute on function public.admin_list_crews(public.crew_status) from public, anon;
grant execute on function public.admin_list_crews(public.crew_status) to authenticated;

-- ---------------------------------------------------------------------
-- Členství
-- ---------------------------------------------------------------------
create function public.join_crew(p_crew_id uuid)
returns public.crew_member_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_crew public.crews;
  v_profile public.profiles;
  v_status public.crew_member_status;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.username is null then
    raise exception 'username_required';
  end if;
  select * into v_crew from public.crews where id = p_crew_id and status = 'approved';
  if not found then
    raise exception 'not_found';
  end if;
  if exists (select 1 from public.crew_members where crew_id = p_crew_id and user_id = v_uid) then
    raise exception 'already_member';
  end if;
  if (select count(*) from public.crew_members where user_id = v_uid) >= 20 then
    raise exception 'membership_limit';
  end if;

  v_status := case when v_crew.join_policy = 'open' then 'active' else 'pending' end;
  insert into public.crew_members (crew_id, user_id, role, status, is_home)
  values (
    p_crew_id, v_uid, 'member', v_status,
    v_status = 'active' and not exists (select 1 from public.crew_members where user_id = v_uid and is_home)
  );

  if v_status = 'pending' then
    insert into public.notifications (user_id, type, payload)
    select m.user_id, 'crew_join_request', jsonb_build_object(
      'crew_name', v_crew.name, 'crew_slug', v_crew.slug,
      'username', v_profile.username, 'display_name', v_profile.display_name)
    from public.crew_members m
    where m.crew_id = p_crew_id and m.status = 'active' and m.role in ('founder', 'admin');
  end if;
  return v_status;
end;
$$;

revoke execute on function public.join_crew(uuid) from public, anon;
grant execute on function public.join_crew(uuid) to authenticated;

create function public.leave_crew(p_crew_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.crew_role;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select role into v_role from public.crew_members where crew_id = p_crew_id and user_id = v_uid;
  if v_role is null then
    raise exception 'not_member';
  end if;
  if v_role = 'founder' then
    raise exception 'founder_cannot_leave';
  end if;
  delete from public.crew_members where crew_id = p_crew_id and user_id = v_uid;
end;
$$;

revoke execute on function public.leave_crew(uuid) from public, anon;
grant execute on function public.leave_crew(uuid) to authenticated;

-- Správce crew: schválit / zamítnout žádost, odebrat člena
create function public.decide_crew_member(p_crew_id uuid, p_user_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.crew_members;
  v_crew public.crews;
begin
  if not public.is_crew_manager(p_crew_id) and not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  select * into v_member from public.crew_members where crew_id = p_crew_id and user_id = p_user_id for update;
  if not found then
    raise exception 'not_member';
  end if;
  if v_member.role = 'founder' then
    raise exception 'not_allowed';
  end if;
  select * into v_crew from public.crews where id = p_crew_id;

  if p_action = 'approve' then
    if v_member.status <> 'pending' then
      return;
    end if;
    update public.crew_members
    set status = 'active',
        joined_at = now(),
        is_home = not exists (select 1 from public.crew_members where user_id = p_user_id and is_home)
    where crew_id = p_crew_id and user_id = p_user_id;
    insert into public.notifications (user_id, type, payload)
    values (p_user_id, 'crew_member_approved', jsonb_build_object('crew_name', v_crew.name, 'crew_slug', v_crew.slug));
  elsif p_action in ('reject', 'remove') then
    delete from public.crew_members where crew_id = p_crew_id and user_id = p_user_id;
  else
    raise exception 'invalid_action';
  end if;
end;
$$;

revoke execute on function public.decide_crew_member(uuid, uuid, text) from public, anon;
grant execute on function public.decide_crew_member(uuid, uuid, text) to authenticated;

-- Domovská crew (p_crew_id null = žádná)
create function public.set_home_crew(p_crew_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_crew_id is not null and not exists (
    select 1 from public.crew_members where crew_id = p_crew_id and user_id = v_uid and status = 'active'
  ) then
    raise exception 'not_member';
  end if;
  update public.crew_members set is_home = false where user_id = v_uid and is_home;
  if p_crew_id is not null then
    update public.crew_members set is_home = true where crew_id = p_crew_id and user_id = v_uid;
  end if;
end;
$$;

revoke execute on function public.set_home_crew(uuid) from public, anon;
grant execute on function public.set_home_crew(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Čtení (jen veřejná data)
-- ---------------------------------------------------------------------

-- Turba, která získali aktivní členové crew (veřejný obsah) od data
create function public.crew_turbos_since(p_crew_id uuid, p_since timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.turbos t
  join public.crew_members m on m.user_id = t.receiver_id and m.crew_id = p_crew_id and m.status = 'active'
  join public.profiles p on p.id = t.receiver_id
  left join public.vehicles v on v.id = t.vehicle_id
  where t.created_at >= p_since
    and p.visibility = 'public'
    and (t.profile_id is not null or v.visibility = 'public');
$$;

revoke execute on function public.crew_turbos_since(uuid, timestamptz) from public, anon, authenticated;

create function public.public_crews(
  p_search text default null,
  p_limit integer default 60,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  name text,
  focus text,
  description text,
  logo_key uuid,
  logo_format text,
  join_policy public.crew_join_policy,
  members integer,
  turbos integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.slug, c.name, c.focus, c.description, c.logo_key, c.logo_format, c.join_policy,
         (select count(*)::integer from public.crew_members m where m.crew_id = c.id and m.status = 'active'),
         public.crew_turbos_since(c.id, '-infinity')
  from public.crews c
  where c.status = 'approved'
    and (
      p_search is null or btrim(p_search) = ''
      or c.name ilike '%' || btrim(p_search) || '%'
      or c.focus ilike '%' || btrim(p_search) || '%'
      or c.name_key like '%' || public.crew_name_key(p_search) || '%'
    )
  order by 9 desc, c.approved_at
  limit least(greatest(coalesce(p_limit, 60), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.public_crews(text, integer, integer) from public;
grant execute on function public.public_crews(text, integer, integer) to anon, authenticated;

-- Podobné crew při zakládání (i čekající, ať nevznikají duplikáty)
create function public.similar_crews(p_name text)
returns table (slug text, name text, status public.crew_status)
language sql
stable
security definer
set search_path = ''
as $$
  select c.slug, c.name, c.status
  from public.crews c
  where c.status in ('approved', 'pending')
    and char_length(public.crew_name_key(p_name)) >= 3
    and (
      c.name_key = public.crew_name_key(p_name)
      or c.name_key like '%' || public.crew_name_key(p_name) || '%'
      or public.crew_name_key(p_name) like '%' || c.name_key || '%'
    )
  order by (c.name_key = public.crew_name_key(p_name)) desc, c.name
  limit 8;
$$;

revoke execute on function public.similar_crews(text) from public, anon;
grant execute on function public.similar_crews(text) to authenticated;

-- Statistiky crew + můj vztah k ní
create function public.crew_stats(p_crew_id uuid)
returns table (
  members integer,
  pending integer,
  turbos_total integer,
  turbos_month integer,
  my_status text,
  my_role public.crew_role,
  my_home boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.crew_members m where m.crew_id = c.id and m.status = 'active'),
    case when public.is_crew_manager(c.id)
      then (select count(*)::integer from public.crew_members m where m.crew_id = c.id and m.status = 'pending')
      else 0 end,
    public.crew_turbos_since(c.id, '-infinity'),
    public.crew_turbos_since(c.id, now() - interval '30 days'),
    coalesce((select m.status::text from public.crew_members m where m.crew_id = c.id and m.user_id = (select auth.uid())), 'none'),
    (select m.role from public.crew_members m where m.crew_id = c.id and m.user_id = (select auth.uid())),
    coalesce((select m.is_home from public.crew_members m where m.crew_id = c.id and m.user_id = (select auth.uid())), false)
  from public.crews c
  where c.id = p_crew_id
    and (c.status = 'approved' or c.founder_id = (select auth.uid()) or public.is_admin());
$$;

revoke execute on function public.crew_stats(uuid) from public;
grant execute on function public.crew_stats(uuid) to anon, authenticated;

-- Členové crew: veřejně jen veřejné profily; správce vidí všechny i žádosti
create function public.crew_member_list(p_crew_id uuid, p_include_pending boolean default false)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_path text,
  verified boolean,
  role public.crew_role,
  status public.crew_member_status,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_path, p.verified_at is not null,
         m.role, m.status, m.joined_at
  from public.crew_members m
  join public.crews c on c.id = m.crew_id
  join public.profiles p on p.id = m.user_id
  where m.crew_id = p_crew_id
    and p.username is not null
    and (
      -- správce / admin: všichni, žádosti jen na vyžádání
      ((public.is_crew_manager(c.id) or public.is_admin())
        and (m.status = 'active' or p_include_pending))
      -- ostatní: schválená crew, aktivní členové s veřejným profilem (a sám sebe)
      or (c.status = 'approved' and m.status = 'active'
          and (p.visibility = 'public' or p.id = (select auth.uid())))
    )
  order by (m.status = 'pending') desc, (m.role = 'founder') desc, (m.role = 'admin') desc, m.joined_at
  limit 500;
$$;

revoke execute on function public.crew_member_list(uuid, boolean) from public;
grant execute on function public.crew_member_list(uuid, boolean) to anon, authenticated;

-- Crew člena (na profil): jen schválené crew a aktivní členství, jen u viditelného profilu
create function public.profile_crews(p_profile_id uuid)
returns table (crew_id uuid, slug text, name text, logo_key uuid, logo_format text, is_home boolean, role public.crew_role)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.slug, c.name, c.logo_key, c.logo_format, m.is_home, m.role
  from public.crew_members m
  join public.crews c on c.id = m.crew_id
  join public.profiles p on p.id = m.user_id
  where m.user_id = p_profile_id
    and m.status = 'active'
    and c.status = 'approved'
    and (p.visibility = 'public' or p.id = (select auth.uid()))
  order by m.is_home desc, m.joined_at;
$$;

revoke execute on function public.profile_crews(uuid) from public;
grant execute on function public.profile_crews(uuid) to anon, authenticated;

-- Žebříčky crew: size = počet členů, active = turba členů za období
create function public.leaderboard_crews(
  p_mode text default 'active',
  p_period text default 'month',
  p_limit integer default 20
)
returns table (crew_id uuid, slug text, name text, focus text, logo_key uuid, logo_format text, members integer, score integer)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select c.id, c.slug, c.name, c.focus, c.logo_key, c.logo_format,
           (select count(*)::integer from public.crew_members m where m.crew_id = c.id and m.status = 'active') as members,
           case when p_mode = 'size'
             then (select count(*)::integer from public.crew_members m where m.crew_id = c.id and m.status = 'active')
             else public.crew_turbos_since(c.id, public.period_start(p_period))
           end as score
    from public.crews c
    where c.status = 'approved'
  ) x
  where x.score > 0
  order by x.score desc, x.members desc, x.name
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke execute on function public.leaderboard_crews(text, text, integer) from public;
grant execute on function public.leaderboard_crews(text, text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Obrázky crew (logo, úvodní fotka): {crew_id}/{key}-{size}.{format}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crew-images', 'crew-images', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "crew-images: read if crew visible"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'crew-images'
    and exists (select 1 from public.crews c where c.id::text = (storage.foldername(name))[1])
  );

create policy "crew-images: upload by managers"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'crew-images'
    and exists (
      select 1 from public.crews c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_crew_manager(c.id)
    )
  );

create policy "crew-images: delete by managers"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'crew-images'
    and exists (
      select 1 from public.crews c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_crew_manager(c.id)
    )
  );
