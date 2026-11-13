-- =====================================================================
-- CREATOR část 3b: turba na pracích v portfoliu
-- - Turbo jde dát fotce i videu v portfoliu (veřejný profil, ne vlastní).
-- - Započítá se do denní série, odznaků za daná / získaná turba
--   a do žebříčku fanoušků; souhrnné upozornění creatorovi (jedno na portfolio).
-- - Do „turb garáže“ a žebříčku garáží se nepočítá (to je za auta a garáž).
-- =====================================================================

alter table public.turbos
  add column portfolio_item_id uuid references public.portfolio_items (id) on delete cascade;

alter table public.turbos drop constraint turbos_one_target;
alter table public.turbos add constraint turbos_one_target check (
  (photo_id is not null and vehicle_id is not null and profile_id is null and portfolio_item_id is null)
  or (photo_id is null and vehicle_id is null and profile_id is not null and portfolio_item_id is null)
  or (photo_id is null and vehicle_id is null and profile_id is null and portfolio_item_id is not null)
);

create unique index turbos_giver_portfolio_unique
  on public.turbos (giver_id, portfolio_item_id) where portfolio_item_id is not null;
create index turbos_portfolio_idx on public.turbos (portfolio_item_id) where portfolio_item_id is not null;

-- Upozornění: klíč „portfolio“ pro turba prací
create or replace function public.turbo_after_insert()
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
  -- práce v portfoliu: jedno souhrnné upozornění na celé portfolio
  v_key := coalesce(new.vehicle_id::text, case when new.portfolio_item_id is not null then 'portfolio' else 'garage' end);
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
      'target', case when new.vehicle_id is not null then 'vehicle'
                     when new.portfolio_item_id is not null then 'portfolio' else 'garage' end,
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


-- Dát / odebrat turbo – nově i práci v portfoliu
drop function public.toggle_turbo(uuid, uuid);

create function public.toggle_turbo(
  p_photo_id uuid default null,
  p_profile_id uuid default null,
  p_portfolio_item_id uuid default null
)
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
  if (p_photo_id is not null)::int + (p_profile_id is not null)::int + (p_portfolio_item_id is not null)::int <> 1 then
    raise exception 'invalid_target';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and username is not null) then
    raise exception 'username_required';
  end if;

  -- Cíl musí být veřejný
  if p_photo_id is not null then
    select v.owner_id, v.id into v_receiver, v_vehicle
    from public.vehicle_photos ph
    join public.vehicles v on v.id = ph.vehicle_id
    join public.profiles p on p.id = v.owner_id
    where ph.id = p_photo_id
      and v.visibility = 'public'
      and p.visibility = 'public';
  elsif p_profile_id is not null then
    select p.id into v_receiver
    from public.profiles p
    where p.id = p_profile_id
      and p.visibility = 'public'
      and p.username is not null;
  else
    select p.id into v_receiver
    from public.portfolio_items pi
    join public.profiles p on p.id = pi.owner_id
    where pi.id = p_portfolio_item_id
      and p.visibility = 'public';
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
    and (t.photo_id = p_photo_id or t.profile_id = p_profile_id or t.portfolio_item_id = p_portfolio_item_id);

  if v_existing is not null then
    delete from public.turbos where id = v_existing;
    given := false;
  else
    insert into public.turbos (giver_id, receiver_id, photo_id, vehicle_id, profile_id, portfolio_item_id)
    values (v_uid, v_receiver, p_photo_id, v_vehicle, p_profile_id, p_portfolio_item_id)
    on conflict do nothing;
    given := true;
  end if;

  select count(*)::integer into total
  from public.turbos t
  where (p_photo_id is not null and t.photo_id = p_photo_id)
     or (p_profile_id is not null and t.profile_id = p_profile_id)
     or (p_portfolio_item_id is not null and t.portfolio_item_id = p_portfolio_item_id);

  return next;
end;
$$;

revoke execute on function public.toggle_turbo(uuid, uuid, uuid) from public, anon;
grant execute on function public.toggle_turbo(uuid, uuid, uuid) to authenticated;

-- Turba prací v portfoliu + zda je dal přihlášený (jen viditelné profily)
create function public.portfolio_turbo_stats(p_item_ids uuid[])
returns table (item_id uuid, turbos integer, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pi.id,
    (select count(*)::integer from public.turbos t where t.portfolio_item_id = pi.id),
    exists (select 1 from public.turbos t
            where t.portfolio_item_id = pi.id and t.giver_id = (select auth.uid()))
  from public.portfolio_items pi
  join public.profiles p on p.id = pi.owner_id
  where pi.id = any (p_item_ids)
    and (p.visibility = 'public' or p.id = (select auth.uid()));
$$;

revoke execute on function public.portfolio_turbo_stats(uuid[]) from public;
grant execute on function public.portfolio_turbo_stats(uuid[]) to anon, authenticated;
