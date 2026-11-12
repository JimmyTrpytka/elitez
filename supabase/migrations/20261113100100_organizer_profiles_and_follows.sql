-- =====================================================================
-- Milník 5c: Pořadatelé – veřejný profil, sledování, upozornění
-- Pravidla: SPEC.md 5.1f
-- =====================================================================

-- ---------------------------------------------------------------------
-- Adresa z názvu (bez diakritiky, malá písmena, pomlčky)
-- ---------------------------------------------------------------------
create function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(
      coalesce(p_text, ''),
      'áäčďéěëíľĺňóôöőřŕšťúůüűýžąćęłńśźżÁÄČĎÉĚËÍĽĹŇÓÔÖŐŘŔŠŤÚŮÜŰÝŽĄĆĘŁŃŚŹŻ',
      'aacdeeeillnoooorrstuuuuyzacelnszzAACDEEEILLNOOOORRSTUUUUYZACELNSZZ'
    )),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

-- ---------------------------------------------------------------------
-- Profil pořadatele: adresa, logo, odkazy, proběhlé eventy
-- ---------------------------------------------------------------------
alter table public.organizers
  add column slug text,
  add column logo_key uuid,
  add column logo_format text check (logo_format in ('webp', 'jpg')),
  add column website_url text check (website_url ~ '^https?://' and char_length(website_url) <= 200),
  add column instagram_url text check (instagram_url ~ '^https?://' and char_length(instagram_url) <= 200),
  add column facebook_url text check (facebook_url ~ '^https?://' and char_length(facebook_url) <= 200),
  add column show_past_events boolean not null default true,
  add constraint organizers_logo check ((logo_key is null) = (logo_format is null));

-- Doplnit adresy stávajícím pořadatelům (při shodě přidat kousek id)
update public.organizers o
set slug = left(coalesce(nullif(public.slugify(o.name), ''), 'poradatel'), 50)
  || case when exists (
       select 1 from public.organizers x
       where x.id <> o.id and public.slugify(x.name) = public.slugify(o.name) and x.created_at < o.created_at
     ) then '-' || left(o.id::text, 4) else '' end;

alter table public.organizers
  alter column slug set not null,
  add constraint organizers_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  add constraint organizers_slug_unique unique (slug);

-- Nový pořadatel dostane adresu automaticky
create function public.organizers_default_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_base text;
begin
  if new.slug is null or new.slug = '' then
    v_base := left(coalesce(nullif(public.slugify(new.name), ''), 'poradatel'), 50);
    new.slug := v_base;
    if exists (select 1 from public.organizers where slug = new.slug) then
      new.slug := v_base || '-' || left(new.id::text, 4);
    end if;
  end if;
  return new;
end;
$$;

create trigger organizers_default_slug
  before insert on public.organizers
  for each row execute function public.organizers_default_slug();

-- Pořadatel smí měnit svůj profil (ne stav)
grant update (slug, logo_key, logo_format, website_url, instagram_url, facebook_url, show_past_events)
  on public.organizers to authenticated;

-- Logo pořadatele: {organizer_id}/{logo_key}-{sm|md}.{format}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('organizer-logos', 'organizer-logos', false, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "organizer-logos: read if organizer visible"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'organizer-logos'
    and exists (
      select 1 from public.organizers o
      where o.id::text = (storage.foldername(name))[1]
    )
  );

create policy "organizer-logos: upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'organizer-logos'
    and exists (
      select 1 from public.organizers o
      where o.id::text = (storage.foldername(name))[1]
        and o.profile_id = (select auth.uid())
    )
  );

create policy "organizer-logos: delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'organizer-logos'
    and exists (
      select 1 from public.organizers o
      where o.id::text = (storage.foldername(name))[1]
        and o.profile_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- Upozornění s časem „ukázat od“ (otevření registrace přesně na čas)
-- Dokud nenastane visible_from, uživatel upozornění nevidí ani nepočítá.
-- ---------------------------------------------------------------------
alter table public.notifications add column visible_from timestamptz;
create index notifications_scheduled_idx on public.notifications (event_id, type) where visible_from is not null;

drop policy "notifications: read own" on public.notifications;
create policy "notifications: read own"
  on public.notifications for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and (visible_from is null or visible_from <= now())
  );

drop policy "notifications: mark own read" on public.notifications;
create policy "notifications: mark own read"
  on public.notifications for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and (visible_from is null or visible_from <= now())
  )
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Sledování pořadatelů
-- ---------------------------------------------------------------------
create table public.organizer_follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, organizer_id)
);

create index organizer_follows_organizer_idx on public.organizer_follows (organizer_id);

alter table public.organizer_follows enable row level security;

create policy "organizer_follows: read own"
  on public.organizer_follows for select
  to authenticated
  using (follower_id = (select auth.uid()));

revoke insert, update, delete on public.organizer_follows from anon, authenticated;

-- Údaje eventu do upozornění
create function public.organizer_event_payload(p_event public.events)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'event_title', p_event.title,
    'event_slug', p_event.slug,
    'event_starts_at', p_event.starts_at,
    'event_ends_at', p_event.ends_at,
    'event_timezone', p_event.timezone,
    'organizer_name', o.name,
    'organizer_slug', o.slug
  )
  from public.organizers o where o.id = p_event.organizer_id;
$$;

revoke execute on function public.organizer_event_payload(public.events) from public, anon, authenticated;

-- Naplánuje „Otevřela se registrace“ sledujícím (p_user = jen jednomu člověku).
-- Verified dostanou upozornění v čase svého předstihu; „jen Verified“ eventy jen Verified.
create function public.schedule_registration_open(p_event public.events, p_user uuid default null)
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
    f.follower_id,
    'organizer_registration_open',
    p_event.id,
    v_payload,
    t.at,
    t.at
  from public.organizer_follows f
  join public.profiles p on p.id = f.follower_id
  cross join lateral (
    select case
      when p.verified_at is not null then coalesce(p_event.registration_verified_opens_at, p_event.registration_opens_at)
      when p_event.access = 'public' then p_event.registration_opens_at
      else null
    end as at
  ) t
  where f.organizer_id = p_event.organizer_id
    and (p_user is null or f.follower_id = p_user)
    and t.at is not null
    and t.at > now()
    and (p_event.registration_closes_at is null or t.at < p_event.registration_closes_at);
end;
$$;

revoke execute on function public.schedule_registration_open(public.events, uuid) from public, anon, authenticated;

-- Smaže naplánovaná (ještě neviditelná) upozornění na otevření registrace
create function public.unschedule_registration_open(p_event_id uuid, p_user uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.notifications
  where event_id = p_event_id
    and type = 'organizer_registration_open'
    and visible_from > now()
    and (p_user is null or user_id = p_user);
$$;

revoke execute on function public.unschedule_registration_open(uuid, uuid) from public, anon, authenticated;

-- Změny eventu → upozornění sledujícím pořadatele
create function public.organizer_event_notify()
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
    select f.follower_id, 'organizer_event_published', new.id, public.organizer_event_payload(new)
    from public.organizer_follows f
    where f.organizer_id = new.organizer_id;
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
    select f.follower_id, 'organizer_event_cancelled', new.id, public.organizer_event_payload(new)
    from public.organizer_follows f
    where f.organizer_id = new.organizer_id;
  end if;
  return new;
end;
$$;

create trigger events_organizer_notify
  after insert or update of status, access, registration_opens_at, registration_verified_opens_at, registration_closes_at
  on public.events
  for each row execute function public.organizer_event_notify();

-- Sledovat / přestat sledovat pořadatele
create function public.toggle_organizer_follow(p_organizer_id uuid)
returns table (following boolean, followers integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.organizers where id = p_organizer_id and status = 'approved') then
    raise exception 'not_found';
  end if;
  if exists (select 1 from public.organizers where id = p_organizer_id and profile_id = v_uid) then
    raise exception 'own_content';
  end if;

  if exists (
    select 1 from public.organizer_follows f
    where f.follower_id = v_uid and f.organizer_id = p_organizer_id
  ) then
    delete from public.organizer_follows f
    where f.follower_id = v_uid and f.organizer_id = p_organizer_id;
    -- už nečekat na otevření registrací tohoto pořadatele
    delete from public.notifications n
    where n.user_id = v_uid
      and n.type = 'organizer_registration_open'
      and n.visible_from > now()
      and n.event_id in (select e.id from public.events e where e.organizer_id = p_organizer_id);
    following := false;
  else
    insert into public.organizer_follows (follower_id, organizer_id)
    values (v_uid, p_organizer_id)
    on conflict do nothing;
    -- naplánovat otevření registrací už zveřejněných eventů
    for v_event in
      select * from public.events e
      where e.organizer_id = p_organizer_id and e.status = 'published'
    loop
      perform public.schedule_registration_open(v_event, v_uid);
    end loop;
    following := true;
  end if;

  select count(*)::integer into followers
  from public.organizer_follows f where f.organizer_id = p_organizer_id;
  return next;
end;
$$;

revoke execute on function public.toggle_organizer_follow(uuid) from public, anon;
grant execute on function public.toggle_organizer_follow(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Veřejné údaje o pořadatelích (jen schválení)
-- ---------------------------------------------------------------------
create function public.public_organizers()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  logo_key uuid,
  logo_format text,
  followers integer,
  upcoming_events integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id, o.slug, o.name, o.description, o.logo_key, o.logo_format,
    (select count(*)::integer from public.organizer_follows f where f.organizer_id = o.id),
    (select count(*)::integer from public.events e
      where e.organizer_id = o.id
        and e.status in ('published', 'closed')
        and e.access in ('public', 'verified_only')
        and e.ends_at >= now())
  from public.organizers o
  where o.status = 'approved'
  order by 8 desc, 7 desc, o.name;
$$;

revoke execute on function public.public_organizers() from public;
grant execute on function public.public_organizers() to anon, authenticated;

create function public.organizer_social_stats(p_organizer_id uuid)
returns table (followers integer, i_follow boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.organizer_follows f where f.organizer_id = o.id),
    exists (select 1 from public.organizer_follows f
            where f.organizer_id = o.id and f.follower_id = (select auth.uid()))
  from public.organizers o
  where o.id = p_organizer_id and o.status = 'approved';
$$;

revoke execute on function public.organizer_social_stats(uuid) from public;
grant execute on function public.organizer_social_stats(uuid) to anon, authenticated;
