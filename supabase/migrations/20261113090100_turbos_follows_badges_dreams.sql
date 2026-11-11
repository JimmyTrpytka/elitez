-- =====================================================================
-- Milník 5b: Turba, sledování, Síň slávy (odznaky) a Garáž snů
-- Pravidla: SPEC.md 5.1e
--
-- Do tabulek turbos, follows, user_badges aplikace NEZAPISUJE přímo.
-- Vše jde přes funkce toggle_turbo / toggle_follow (security definer),
-- které kontrolují viditelnost, vlastní obsah a udělují odznaky.
-- Počty a žebříčky čte aplikace přes funkce, které vrací jen veřejná data.
-- =====================================================================

-- Dnešní den v pražském čase (pro denní sérii)
create function public.prague_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Prague')::date;
$$;

-- ---------------------------------------------------------------------
-- Turba
-- Cíl je buď fotka vozidla (photo_id + vehicle_id), nebo garáž (profile_id).
-- receiver_id = majitel cíle (kvůli rychlým součtům a odznakům).
-- ---------------------------------------------------------------------
create table public.turbos (
  id uuid primary key default gen_random_uuid(),
  giver_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  photo_id uuid references public.vehicle_photos (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint turbos_one_target check (
    (photo_id is not null and vehicle_id is not null and profile_id is null)
    or (photo_id is null and vehicle_id is null and profile_id is not null)
  ),
  constraint turbos_not_own check (giver_id <> receiver_id)
);

create unique index turbos_giver_photo_unique
  on public.turbos (giver_id, photo_id) where photo_id is not null;
create unique index turbos_giver_profile_unique
  on public.turbos (giver_id, profile_id) where profile_id is not null;
create index turbos_photo_idx on public.turbos (photo_id);
create index turbos_vehicle_idx on public.turbos (vehicle_id, created_at);
create index turbos_profile_idx on public.turbos (profile_id, created_at);
create index turbos_receiver_idx on public.turbos (receiver_id, created_at);
create index turbos_giver_idx on public.turbos (giver_id, created_at);

alter table public.turbos enable row level security;

-- Přímo smí uživatel číst jen turba, která sám dal („už jsem dal turbo?“).
create policy "turbos: read own given"
  on public.turbos for select
  to authenticated
  using (giver_id = (select auth.uid()));

revoke insert, update, delete on public.turbos from anon, authenticated;

-- Dny, kdy uživatel dal aspoň jedno turbo (denní série 🔥).
-- Zůstávají i po odebrání turba.
create table public.turbo_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

alter table public.turbo_days enable row level security;

create policy "turbo_days: read own"
  on public.turbo_days for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.turbo_days from anon, authenticated;

-- Aktuální série: počet po sobě jdoucích dnů končících dnes nebo včera
create function public.user_streak(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with last_day as (
    select max(day) as d from public.turbo_days where user_id = p_user
  ),
  days as (
    select day, row_number() over (order by day desc) as rn
    from public.turbo_days where user_id = p_user
  )
  select case
    when (select d from last_day) is null
      or (select d from last_day) < public.prague_today() - 1 then 0
    else (
      select count(*)::integer from days
      where day = (select d from last_day) - (rn - 1)::integer
    )
  end;
$$;

revoke execute on function public.user_streak(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Sledování garáží
-- ---------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

create index follows_following_idx on public.follows (following_id, created_at desc);

alter table public.follows enable row level security;

create policy "follows: read own"
  on public.follows for select
  to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

revoke insert, update, delete on public.follows from anon, authenticated;

-- ---------------------------------------------------------------------
-- Odznaky (Síň slávy) – obecný katalog + udělené odznaky
-- ---------------------------------------------------------------------
create type public.badge_rarity as enum ('common', 'rare', 'epic', 'legendary');

create table public.badges (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  -- turbo_received / turbo_given / streak = automaticky podle hranice (threshold)
  category text not null check (category in (
    'turbo_received', 'turbo_given', 'streak', 'discoverer',
    'community', 'event', 'challenge', 'manual'
  )),
  icon text not null check (icon ~ '^[a-z0-9_]{2,40}$'),
  rarity public.badge_rarity not null default 'common',
  -- unikátní = smí ho mít jen jeden člověk vůbec
  is_unique boolean not null default false,
  threshold integer check (threshold > 0),
  name_cs text not null check (char_length(name_cs) between 1 and 80),
  name_en text not null check (char_length(name_en) between 1 and 80),
  description_cs text not null check (char_length(description_cs) <= 300),
  description_en text not null check (char_length(description_en) <= 300),
  sort smallint not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.badges enable row level security;

create policy "badges: read all"
  on public.badges for select
  to anon, authenticated
  using (true);

create policy "badges: admin manages"
  on public.badges for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke insert, update, delete on public.badges from anon;

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_code text not null references public.badges (code) on update cascade,
  -- rozlišení opakovaných odznaků (např. rok u „Garáž roku“, event u účasti)
  context_key text not null default '' check (char_length(context_key) <= 80),
  source text not null default 'auto' check (source in ('auto', 'admin', 'event', 'challenge')),
  awarded_by uuid references public.profiles (id) on delete set null,
  note text check (char_length(note) <= 300),
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_code, context_key)
);

create index user_badges_badge_idx on public.user_badges (badge_code);

alter table public.user_badges enable row level security;

-- Číst: když je vidět profil (veřejný nebo vlastní – uplatní se RLS profilů)
create policy "user_badges: read if profile visible"
  on public.user_badges for select
  to anon, authenticated
  using (exists (select 1 from public.profiles p where p.id = user_id));

revoke insert, update, delete on public.user_badges from anon, authenticated;

-- Udělí odznak (interní). Vrací true, pokud se opravdu udělil.
create function public.award_badge(
  p_user uuid,
  p_code text,
  p_source text default 'auto',
  p_context text default '',
  p_by uuid default null,
  p_note text default null,
  p_notify boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_badge public.badges;
  v_id uuid;
begin
  select * into v_badge from public.badges where code = p_code and active;
  if not found then
    return false;
  end if;

  if v_badge.is_unique then
    -- jen jeden držitel: zámek, aby ho nezískali dva současně
    perform pg_advisory_xact_lock(hashtext('badge:' || p_code));
    if exists (select 1 from public.user_badges where badge_code = p_code) then
      return false;
    end if;
  end if;

  insert into public.user_badges (user_id, badge_code, context_key, source, awarded_by, note)
  values (p_user, p_code, coalesce(p_context, ''), p_source, p_by, p_note)
  on conflict (user_id, badge_code, context_key) do nothing
  returning id into v_id;

  if v_id is null then
    return false;
  end if;

  if p_notify then
    insert into public.notifications (user_id, type, payload)
    values (p_user, 'badge_awarded', jsonb_build_object(
      'badge', v_badge.code,
      'icon', v_badge.icon,
      'rarity', v_badge.rarity,
      'name_cs', v_badge.name_cs,
      'name_en', v_badge.name_en
    ));
  end if;
  return true;
end;
$$;

revoke execute on function public.award_badge(uuid, text, text, text, uuid, text, boolean)
  from public, anon, authenticated;

-- Udělí všechny odznaky dané kategorie, jejichž hranice je dosažená (interní)
create function public.award_threshold_badges(p_user uuid, p_category text, p_value integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  for v_code in
    select b.code from public.badges b
    where b.category = p_category
      and b.active
      and b.threshold is not null
      and b.threshold <= p_value
      and not exists (
        select 1 from public.user_badges ub
        where ub.user_id = p_user and ub.badge_code = b.code
      )
    order by b.threshold
  loop
    perform public.award_badge(p_user, v_code);
  end loop;
end;
$$;

revoke execute on function public.award_threshold_badges(uuid, text, integer)
  from public, anon, authenticated;

-- Ruční udělení / odebrání odznaku adminem
create function public.admin_award_badge(
  p_user_id uuid,
  p_code text,
  p_context text default '',
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from public.badges where code = p_code) then
    raise exception 'badge_not_found';
  end if;
  return public.award_badge(p_user_id, p_code, 'admin', coalesce(p_context, ''), auth.uid(), p_note);
end;
$$;

revoke execute on function public.admin_award_badge(uuid, text, text, text) from public, anon;
grant execute on function public.admin_award_badge(uuid, text, text, text) to authenticated;

create function public.admin_revoke_badge(p_user_badge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  delete from public.user_badges where id = p_user_badge_id;
end;
$$;

revoke execute on function public.admin_revoke_badge(uuid) from public, anon;
grant execute on function public.admin_revoke_badge(uuid) to authenticated;

-- Katalog odznaků (lze rozšiřovat dalšími řádky)
insert into public.badges
  (code, category, icon, rarity, is_unique, threshold, sort, name_cs, name_en, description_cs, description_en)
values
  ('turbo_bronze', 'turbo_received', 'turbo_bronze', 'rare', false, 100, 10,
   'Bronzové turbo', 'Bronze turbo',
   'Garáž a fotky získaly 100 turb.', 'Garage and photos received 100 turbos.'),
  ('turbo_silver', 'turbo_received', 'turbo_silver', 'epic', false, 500, 11,
   'Stříbrné turbo', 'Silver turbo',
   'Garáž a fotky získaly 500 turb.', 'Garage and photos received 500 turbos.'),
  ('turbo_gold', 'turbo_received', 'turbo_gold', 'legendary', false, 1000, 12,
   'Zlaté turbo', 'Gold turbo',
   'Garáž a fotky získaly 1000 turb.', 'Garage and photos received 1,000 turbos.'),
  ('turbo_first_1000', 'turbo_received', 'crown', 'legendary', true, 1000, 13,
   'První s 1000 turby', 'First to 1,000 turbos',
   'Úplně první člen klubu, který získal 1000 turb. Jen jeden na světě.',
   'The very first club member to receive 1,000 turbos. Only one in the world.'),
  ('fan_50', 'turbo_given', 'fan', 'common', false, 50, 20,
   'Nadšenec', 'Enthusiast',
   'Rozdal 50 turb.', 'Gave 50 turbos.'),
  ('fan_250', 'turbo_given', 'fan', 'rare', false, 250, 21,
   'Fanoušek scény', 'Scene fan',
   'Rozdal 250 turb.', 'Gave 250 turbos.'),
  ('fan_1000', 'turbo_given', 'fan', 'epic', false, 1000, 22,
   'Legenda komunity', 'Community legend',
   'Rozdal 1000 turb.', 'Gave 1,000 turbos.'),
  ('streak_7', 'streak', 'flame', 'common', false, 7, 30,
   'Série 7 dní', '7-day streak',
   'Dával turbo 7 dní v řadě.', 'Gave a turbo 7 days in a row.'),
  ('streak_30', 'streak', 'flame', 'rare', false, 30, 31,
   'Série 30 dní', '30-day streak',
   'Dával turbo 30 dní v řadě.', 'Gave a turbo 30 days in a row.'),
  ('streak_100', 'streak', 'flame', 'epic', false, 100, 32,
   'Série 100 dní', '100-day streak',
   'Dával turbo 100 dní v řadě.', 'Gave a turbo 100 days in a row.'),
  ('discoverer', 'discoverer', 'compass', 'epic', false, 100, 40,
   'Objevitel', 'Discoverer',
   'Dal turbo mezi prvními 10 autu, které později získalo 100 turb.',
   'Was among the first 10 to give a turbo to a car that later reached 100 turbos.'),
  ('founding_member', 'community', 'star', 'rare', false, 100, 50,
   'Zakládající člen', 'Founding member',
   'Jeden z prvních 100 členů klubu.', 'One of the first 100 club members.'),
  ('garage_of_year', 'manual', 'trophy', 'legendary', false, null, 60,
   'Garáž roku', 'Garage of the year',
   'Ocenění klubu ELITEZ za výjimečnou garáž.', 'ELITEZ club award for an outstanding garage.');

-- Zakládající člen: prvních 100 registrovaných
create function public.award_founding_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
begin
  select threshold into v_limit from public.badges where code = 'founding_member' and active;
  if v_limit is not null
     and (select count(*) from public.profiles where created_at <= new.created_at) <= v_limit then
    perform public.award_badge(new.id, 'founding_member');
  end if;
  return new;
end;
$$;

create trigger profiles_founding_member
  after insert on public.profiles
  for each row execute function public.award_founding_member();

-- Stávající členové (bez upozornění)
select public.award_badge(p.id, 'founding_member', 'auto', '', null, null, false)
from (
  select id from public.profiles order by created_at, id limit 100
) p;

-- ---------------------------------------------------------------------
-- Po přidání turba: série, odznaky, Objevitel, souhrnné upozornění
-- ---------------------------------------------------------------------
create function public.turbo_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_threshold integer;
  v_giver_ids uuid[];
  v_giver uuid;
  v_username text;
  v_key text;
  v_vehicle text;
  v_notif_id uuid;
  v_payload jsonb;
begin
  -- Denní série
  insert into public.turbo_days (user_id, day)
  values (new.giver_id, public.prague_today())
  on conflict do nothing;

  -- Odznaky příjemce (získaná turba) a dárce (daná turba, série)
  select count(*) into v_count from public.turbos where receiver_id = new.receiver_id;
  perform public.award_threshold_badges(new.receiver_id, 'turbo_received', v_count);

  select count(*) into v_count from public.turbos where giver_id = new.giver_id;
  perform public.award_threshold_badges(new.giver_id, 'turbo_given', v_count);
  perform public.award_threshold_badges(new.giver_id, 'streak', public.user_streak(new.giver_id));

  -- Objevitel: auto dosáhlo hranice → prvních 10 dárců dostane odznak
  if new.vehicle_id is not null then
    select threshold into v_threshold from public.badges where code = 'discoverer' and active;
    if v_threshold is not null then
      select count(*) into v_count from public.turbos where vehicle_id = new.vehicle_id;
      if v_count >= v_threshold then
        select array_agg(g.giver_id) into v_giver_ids
        from (
          select giver_id, min(created_at) as first_at
          from public.turbos
          where vehicle_id = new.vehicle_id
          group by giver_id
          order by first_at
          limit 10
        ) g;
        foreach v_giver in array coalesce(v_giver_ids, '{}') loop
          perform public.award_badge(v_giver, 'discoverer');
        end loop;
      end if;
    end if;
  end if;

  -- Souhrnné upozornění majiteli: jedno nepřečtené na auto / garáž
  -- jméno jen u veřejného profilu (soukromý dárce se jen započítá)
  select case when visibility = 'public' then username end into v_username
  from public.profiles where id = new.giver_id;
  v_key := coalesce(new.vehicle_id::text, 'garage');
  if new.vehicle_id is not null then
    select make || ' ' || model into v_vehicle from public.vehicles where id = new.vehicle_id;
  end if;

  select id, payload into v_notif_id, v_payload
  from public.notifications
  where user_id = new.receiver_id
    and type = 'turbo_received'
    and read_at is null
    and payload ->> 'key' = v_key
  order by created_at desc
  limit 1
  for update;

  if v_notif_id is null then
    insert into public.notifications (user_id, type, payload)
    values (new.receiver_id, 'turbo_received', jsonb_build_object(
      'key', v_key,
      'target', case when new.vehicle_id is null then 'garage' else 'vehicle' end,
      'vehicle_id', new.vehicle_id,
      'vehicle', v_vehicle,
      'givers', case when v_username is null then '[]'::jsonb else jsonb_build_array(v_username) end,
      'giver_ids', jsonb_build_array(new.giver_id::text),
      'count', 1
    ));
  elsif not ((v_payload -> 'giver_ids') ? new.giver_id::text) then
    update public.notifications
    set created_at = now(),
        payload = v_payload || jsonb_build_object(
          'count', coalesce((v_payload ->> 'count')::integer, 0) + 1,
          -- poslední tři jména, nejnovější první
          'givers', (
            select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
            from jsonb_array_elements(
              case when v_username is null then '[]'::jsonb else jsonb_build_array(v_username) end
                || coalesce(v_payload -> 'givers', '[]'::jsonb)
            ) with ordinality as t(e, i)
            where i <= 3
          ),
          'giver_ids', case
            when jsonb_array_length(coalesce(v_payload -> 'giver_ids', '[]'::jsonb)) < 200
              then coalesce(v_payload -> 'giver_ids', '[]'::jsonb) || jsonb_build_array(new.giver_id::text)
            else v_payload -> 'giver_ids'
          end
        )
    where id = v_notif_id;
  end if;

  return new;
end;
$$;

create trigger turbos_after_insert
  after insert on public.turbos
  for each row execute function public.turbo_after_insert();

-- ---------------------------------------------------------------------
-- Dát / odebrat turbo (jediný způsob zápisu)
-- ---------------------------------------------------------------------
create function public.toggle_turbo(p_photo_id uuid default null, p_profile_id uuid default null)
returns table (given boolean, total integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_receiver uuid;
  v_vehicle uuid;
  v_existing uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if (p_photo_id is null) = (p_profile_id is null) then
    raise exception 'invalid_target';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and username is not null) then
    raise exception 'username_required';
  end if;

  -- Cíl musí být veřejný (veřejné vozidlo ve veřejném profilu / veřejný profil)
  if p_photo_id is not null then
    select v.owner_id, v.id into v_receiver, v_vehicle
    from public.vehicle_photos ph
    join public.vehicles v on v.id = ph.vehicle_id
    join public.profiles p on p.id = v.owner_id
    where ph.id = p_photo_id
      and v.visibility = 'public'
      and p.visibility = 'public';
  else
    select p.id into v_receiver
    from public.profiles p
    where p.id = p_profile_id
      and p.visibility = 'public'
      and p.username is not null;
  end if;

  if v_receiver is null then
    raise exception 'not_found';
  end if;
  if v_receiver = v_uid then
    raise exception 'own_content';
  end if;

  select t.id into v_existing
  from public.turbos t
  where t.giver_id = v_uid
    and (t.photo_id = p_photo_id or t.profile_id = p_profile_id);

  if v_existing is not null then
    delete from public.turbos where id = v_existing;
    given := false;
  else
    insert into public.turbos (giver_id, receiver_id, photo_id, vehicle_id, profile_id)
    values (v_uid, v_receiver, p_photo_id, v_vehicle, p_profile_id)
    on conflict do nothing;
    given := true;
  end if;

  select count(*)::integer into total
  from public.turbos t
  where (p_photo_id is not null and t.photo_id = p_photo_id)
     or (p_profile_id is not null and t.profile_id = p_profile_id);

  return next;
end;
$$;

revoke execute on function public.toggle_turbo(uuid, uuid) from public, anon;
grant execute on function public.toggle_turbo(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Sledovat / přestat sledovat garáž
-- ---------------------------------------------------------------------
create function public.toggle_follow(p_profile_id uuid)
returns table (following boolean, followers integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_me from public.profiles where id = v_uid;
  if v_me.username is null then
    raise exception 'username_required';
  end if;
  if p_profile_id = v_uid then
    raise exception 'own_content';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and visibility = 'public' and username is not null
  ) then
    raise exception 'not_found';
  end if;

  if exists (
    select 1 from public.follows f
    where f.follower_id = v_uid and f.following_id = p_profile_id
  ) then
    delete from public.follows f
    where f.follower_id = v_uid and f.following_id = p_profile_id;
    following := false;
  else
    insert into public.follows (follower_id, following_id)
    values (v_uid, p_profile_id)
    on conflict do nothing;
    following := true;

    -- Upozornění (ne znovu, dokud předchozí od stejného člověka nebylo přečteno)
    if not exists (
      select 1 from public.notifications n
      where n.user_id = p_profile_id
        and n.type = 'new_follower'
        and n.read_at is null
        and n.payload ->> 'follower_id' = v_uid::text
    ) then
      insert into public.notifications (user_id, type, payload)
      values (p_profile_id, 'new_follower', jsonb_build_object(
        'follower_id', v_uid,
        -- soukromý profil: bez jména
        'username', case when v_me.visibility = 'public' then v_me.username end,
        'display_name', case when v_me.visibility = 'public' then v_me.display_name end
      ));
    end if;
  end if;

  select count(*)::integer into followers
  from public.follows f where f.following_id = p_profile_id;

  return next;
end;
$$;

revoke execute on function public.toggle_follow(uuid) from public, anon;
grant execute on function public.toggle_follow(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Čtení počtů (jen pro obsah, který volající smí vidět)
-- ---------------------------------------------------------------------

-- Smí volající vidět vozidlo? (vlastní, nebo veřejné ve veřejném profilu)
create function public.vehicle_is_visible(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vehicles v
    join public.profiles p on p.id = v.owner_id
    where v.id = p_vehicle_id
      and (v.owner_id = (select auth.uid())
           or (v.visibility = 'public' and p.visibility = 'public'))
  );
$$;

revoke execute on function public.vehicle_is_visible(uuid) from public, anon, authenticated;

-- Statistiky profilu / garáže
create function public.profile_social_stats(p_profile_id uuid)
returns table (
  garage_turbos integer,     -- turba garáže + fotek veřejných vozidel
  profile_turbos integer,    -- jen turba garáže
  received_total integer,    -- vše, co kdy získal (pro odznaky)
  given_total integer,
  followers integer,
  following integer,
  streak integer,
  i_follow boolean,
  i_turboed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.turbos t
      left join public.vehicles v on v.id = t.vehicle_id
      where t.receiver_id = p.id
        and (t.profile_id is not null or v.visibility = 'public')),
    (select count(*)::integer from public.turbos t where t.profile_id = p.id),
    (select count(*)::integer from public.turbos t where t.receiver_id = p.id),
    (select count(*)::integer from public.turbos t where t.giver_id = p.id),
    (select count(*)::integer from public.follows f where f.following_id = p.id),
    (select count(*)::integer from public.follows f where f.follower_id = p.id),
    public.user_streak(p.id),
    exists (select 1 from public.follows f
            where f.following_id = p.id and f.follower_id = (select auth.uid())),
    exists (select 1 from public.turbos t
            where t.profile_id = p.id and t.giver_id = (select auth.uid()))
  from public.profiles p
  where p.id = p_profile_id
    and (p.visibility = 'public' or p.id = (select auth.uid()));
$$;

revoke execute on function public.profile_social_stats(uuid) from public;
grant execute on function public.profile_social_stats(uuid) to anon, authenticated;

-- Turba jednotlivých fotek + zda je dal přihlášený uživatel
create function public.photo_turbo_stats(p_photo_ids uuid[])
returns table (photo_id uuid, turbos integer, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ph.id,
    (select count(*)::integer from public.turbos t where t.photo_id = ph.id),
    exists (select 1 from public.turbos t
            where t.photo_id = ph.id and t.giver_id = (select auth.uid()))
  from public.vehicle_photos ph
  where ph.id = any (p_photo_ids)
    and public.vehicle_is_visible(ph.vehicle_id);
$$;

revoke execute on function public.photo_turbo_stats(uuid[]) from public;
grant execute on function public.photo_turbo_stats(uuid[]) to anon, authenticated;

-- Kdo dal turbo (jen veřejné profily, nejnovější první).
-- Cíl: fotka, celé vozidlo (všechny fotky) nebo garáž.
create function public.turbo_givers(
  p_photo_id uuid default null,
  p_vehicle_id uuid default null,
  p_profile_id uuid default null,
  p_limit integer default 20
)
returns table (username text, display_name text, avatar_path text, given_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select g.username, g.display_name, g.avatar_path, max(t.created_at)
  from public.turbos t
  join public.profiles g on g.id = t.giver_id
  where g.visibility = 'public'
    and g.username is not null
    and (
      (p_photo_id is not null and t.photo_id = p_photo_id
        and exists (select 1 from public.vehicle_photos ph
                    where ph.id = p_photo_id and public.vehicle_is_visible(ph.vehicle_id)))
      or (p_vehicle_id is not null and t.vehicle_id = p_vehicle_id
        and public.vehicle_is_visible(p_vehicle_id))
      or (p_profile_id is not null and t.profile_id = p_profile_id
        and exists (select 1 from public.profiles p
                    where p.id = p_profile_id
                      and (p.visibility = 'public' or p.id = (select auth.uid()))))
    )
  group by g.id
  order by max(t.created_at) desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke execute on function public.turbo_givers(uuid, uuid, uuid, integer) from public;
grant execute on function public.turbo_givers(uuid, uuid, uuid, integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Žebříčky (jen veřejné profily a vozidla)
-- Období: week = posledních 7 dní, month = 30, year = 365, all = celkem
-- ---------------------------------------------------------------------
create function public.period_start(p_period text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case p_period
    when 'week' then now() - interval '7 days'
    when 'month' then now() - interval '30 days'
    when 'year' then now() - interval '365 days'
    else '-infinity'::timestamptz
  end;
$$;

create function public.leaderboard_vehicles(p_period text default 'week', p_limit integer default 20)
returns table (
  vehicle_id uuid,
  make text,
  model text,
  year smallint,
  owner_username text,
  owner_display_name text,
  cover_photo_id uuid,
  cover_format text,
  turbos integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.make, v.model, v.year, p.username, p.display_name,
         ph.id, ph.format, count(t.id)::integer
  from public.turbos t
  join public.vehicles v on v.id = t.vehicle_id
  join public.profiles p on p.id = v.owner_id
  left join lateral (
    select x.id, x.format from public.vehicle_photos x
    where x.vehicle_id = v.id
    order by x.position, x.created_at
    limit 1
  ) ph on true
  where t.created_at >= public.period_start(p_period)
    and v.visibility = 'public'
    and p.visibility = 'public'
    and p.username is not null
  group by v.id, p.id, ph.id, ph.format
  order by count(t.id) desc, max(t.created_at) asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

create function public.leaderboard_garages(p_period text default 'week', p_limit integer default 20)
returns table (
  profile_id uuid,
  username text,
  display_name text,
  avatar_path text,
  verified_at timestamptz,
  turbos integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_path, p.verified_at, count(t.id)::integer
  from public.turbos t
  join public.profiles p on p.id = t.receiver_id
  left join public.vehicles v on v.id = t.vehicle_id
  where t.created_at >= public.period_start(p_period)
    and p.visibility = 'public'
    and p.username is not null
    and (t.profile_id is not null or v.visibility = 'public')
  group by p.id
  order by count(t.id) desc, max(t.created_at) asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

create function public.leaderboard_fans(p_period text default 'week', p_limit integer default 20)
returns table (
  profile_id uuid,
  username text,
  display_name text,
  avatar_path text,
  verified_at timestamptz,
  turbos integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_path, p.verified_at, count(t.id)::integer
  from public.turbos t
  join public.profiles p on p.id = t.giver_id
  where t.created_at >= public.period_start(p_period)
    and p.visibility = 'public'
    and p.username is not null
  group by p.id
  order by count(t.id) desc, max(t.created_at) asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke execute on function public.leaderboard_vehicles(text, integer) from public;
revoke execute on function public.leaderboard_garages(text, integer) from public;
revoke execute on function public.leaderboard_fans(text, integer) from public;
grant execute on function public.leaderboard_vehicles(text, integer) to anon, authenticated;
grant execute on function public.leaderboard_garages(text, integer) to anon, authenticated;
grant execute on function public.leaderboard_fans(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Garáž snů
-- ---------------------------------------------------------------------
create type public.dream_status as enum ('dreaming', 'planning', 'searching');

create table public.dream_cars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  make text not null check (char_length(make) between 1 and 60),
  model text not null check (char_length(model) between 1 and 80),
  year_from smallint check (year_from between 1885 and 2100),
  year_to smallint check (year_to between 1885 and 2100),
  note text check (char_length(note) <= 500),
  status public.dream_status not null default 'dreaming',
  visibility public.visibility not null default 'public',
  -- „Tohle chci!“ – odkaz na vozidlo jiného člena
  linked_vehicle_id uuid references public.vehicles (id) on delete set null,
  -- vlastní fotka: {owner_id}/{dream_id}/{photo_key}-{sm|md|lg}.{format}
  photo_key uuid,
  photo_format text check (photo_format in ('webp', 'jpg')),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dream_cars_years check (year_from is null or year_to is null or year_to >= year_from),
  constraint dream_cars_photo check ((photo_key is null) = (photo_format is null))
);

create index dream_cars_owner_idx on public.dream_cars (owner_id, position, created_at);
create unique index dream_cars_linked_unique
  on public.dream_cars (owner_id, linked_vehicle_id) where linked_vehicle_id is not null;
create index dream_cars_linked_idx on public.dream_cars (linked_vehicle_id);

create trigger dream_cars_set_updated_at
  before update on public.dream_cars
  for each row execute function public.set_updated_at();

alter table public.dream_cars enable row level security;

-- Číst: své vždy; cizí jen veřejné ve veřejném profilu
create policy "dream_cars: read public or own"
  on public.dream_cars for select
  to anon, authenticated
  using (
    owner_id = (select auth.uid())
    or (
      visibility = 'public'
      and exists (
        select 1 from public.profiles p
        where p.id = dream_cars.owner_id and p.visibility = 'public'
      )
    )
  );

-- Zapsat: jen své; odkaz jen na cizí vozidlo, které uživatel vidí (RLS vozidel)
create policy "dream_cars: insert own"
  on public.dream_cars for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (
      linked_vehicle_id is null
      or exists (
        select 1 from public.vehicles v
        where v.id = linked_vehicle_id and v.owner_id <> (select auth.uid())
      )
    )
  );

create policy "dream_cars: update own"
  on public.dream_cars for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (
      linked_vehicle_id is null
      or exists (
        select 1 from public.vehicles v
        where v.id = linked_vehicle_id and v.owner_id <> (select auth.uid())
      )
    )
  );

create policy "dream_cars: delete own"
  on public.dream_cars for delete
  to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.dream_cars from anon;
grant select on public.dream_cars to anon;

-- Nejvýš 50 snů na člena
create function public.enforce_dream_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.dream_cars where owner_id = new.owner_id) >= 50 then
    raise exception 'dream_limit';
  end if;
  return new;
end;
$$;

create trigger dream_cars_limit
  before insert on public.dream_cars
  for each row execute function public.enforce_dream_limit();

-- Turba a „v garáži snů“ pro více vozidel najednou (karty, detail)
create function public.vehicle_social_stats(p_vehicle_ids uuid[])
returns table (vehicle_id uuid, turbos integer, dreamers integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.id,
    (select count(*)::integer from public.turbos t where t.vehicle_id = v.id),
    (select count(*)::integer from public.dream_cars d where d.linked_vehicle_id = v.id)
  from public.vehicles v
  where v.id = any (p_vehicle_ids)
    and public.vehicle_is_visible(v.id);
$$;

revoke execute on function public.vehicle_social_stats(uuid[]) from public;
grant execute on function public.vehicle_social_stats(uuid[]) to anon, authenticated;

-- Úložiště fotek Garáže snů (soukromé, zobrazení přes podepsané odkazy)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dream-photos', 'dream-photos', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "dream-photos: read if dream visible"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'dream-photos'
    and exists (
      select 1 from public.dream_cars d
      where d.id::text = (storage.foldername(name))[2]
    )
  );

create policy "dream-photos: upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'dream-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.dream_cars d
      where d.id::text = (storage.foldername(name))[2]
        and d.owner_id = (select auth.uid())
    )
  );

create policy "dream-photos: delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'dream-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
