-- =====================================================================
-- CREATOR část 3a: galerie eventu a označení aut / eventů u fotek
-- - Galerie eventu = fotky, které nahraje pořadatel (event_photos)
--   + práce z portfolia, které schválená média označila eventem.
--   Pořadatel může kteroukoli práci médií v galerii skrýt.
-- - Creator může u práce v portfoliu označit veřejné auto člena: práce se
--   hned ukáže u auta („Fotky od creatorů“), majitel dostane upozornění
--   a označení může kdykoli odebrat.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Pomocná: smí přihlášený (nebo návštěvník) vidět event?
-- (stejná pravidla jako „events: read visible“)
-- ---------------------------------------------------------------------
create function public.event_is_visible(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and (
        (e.status <> 'draft' and e.access in ('public', 'verified_only'))
        or (e.status <> 'draft' and e.access = 'crew_only' and public.is_organizer_crew_member(e.organizer_id))
        or public.is_event_organizer(e.id)
      )
  );
$$;

revoke execute on function public.event_is_visible(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Označení u prací v portfoliu
-- ---------------------------------------------------------------------
alter table public.portfolio_items
  add column event_id uuid references public.events (id) on delete set null,
  add column vehicle_id uuid references public.vehicles (id) on delete set null,
  add column hidden_in_event boolean not null default false;

create index portfolio_items_event_idx on public.portfolio_items (event_id) where event_id is not null;
create index portfolio_items_vehicle_idx on public.portfolio_items (vehicle_id) where vehicle_id is not null;

-- Creator mění označení sám; skrytí v galerii jen pořadatel (funkcí)
grant update (event_id, vehicle_id) on public.portfolio_items to authenticated;

-- Kontrola označení: event jen se schválenou akreditací, auto jen veřejné
create function public.portfolio_items_check_tags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_id is not null and (tg_op = 'INSERT' or new.event_id is distinct from old.event_id) then
    if not exists (
      select 1 from public.event_media_requests m
      where m.event_id = new.event_id and m.user_id = new.owner_id and m.status = 'approved'
    ) then
      raise exception 'not_event_media';
    end if;
    new.hidden_in_event := false;
  end if;
  if new.vehicle_id is not null and (tg_op = 'INSERT' or new.vehicle_id is distinct from old.vehicle_id) then
    if not exists (
      select 1 from public.vehicles v
      join public.profiles p on p.id = v.owner_id
      where v.id = new.vehicle_id and v.visibility = 'public' and p.visibility = 'public'
    ) then
      raise exception 'vehicle_unavailable';
    end if;
  end if;
  return new;
end;
$$;

create trigger portfolio_items_check_tags
  before insert or update of event_id, vehicle_id on public.portfolio_items
  for each row execute function public.portfolio_items_check_tags();

-- Upozornění majiteli auta (ne sám sobě)
create function public.portfolio_items_notify_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_vehicle text;
  v_creator public.profiles;
begin
  if new.vehicle_id is null or (tg_op = 'UPDATE' and new.vehicle_id is not distinct from old.vehicle_id) then
    return new;
  end if;
  select owner_id, make || ' ' || model into v_owner, v_vehicle from public.vehicles where id = new.vehicle_id;
  if v_owner is null or v_owner = new.owner_id then return new; end if;
  select * into v_creator from public.profiles where id = new.owner_id;
  insert into public.notifications (user_id, type, payload)
  values (v_owner, 'vehicle_tagged', jsonb_build_object(
    'vehicle_id', new.vehicle_id,
    'vehicle', v_vehicle,
    'username', case when v_creator.visibility = 'public' then v_creator.username end,
    'display_name', case when v_creator.visibility = 'public' then v_creator.display_name end
  ));
  return new;
end;
$$;

create trigger portfolio_items_notify_tag
  after insert or update of vehicle_id on public.portfolio_items
  for each row execute function public.portfolio_items_notify_tag();

-- Majitel auta odebere označení svého auta
create function public.untag_vehicle_photo(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.portfolio_items pi
  set vehicle_id = null
  where pi.id = p_item_id
    and exists (select 1 from public.vehicles v where v.id = pi.vehicle_id and v.owner_id = auth.uid());
  if not found then raise exception 'not_allowed'; end if;
end;
$$;

-- Pořadatel skryje / znovu ukáže práci médií v galerii svého eventu
create function public.set_event_photo_hidden(p_item_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.portfolio_items pi
  set hidden_in_event = coalesce(p_hidden, false)
  where pi.id = p_item_id and pi.event_id is not null and public.is_event_organizer(pi.event_id);
  if not found then raise exception 'not_allowed'; end if;
end;
$$;

revoke execute on function public.untag_vehicle_photo(uuid) from public, anon;
revoke execute on function public.set_event_photo_hidden(uuid, boolean) from public, anon;
grant execute on function public.untag_vehicle_photo(uuid) to authenticated;
grant execute on function public.set_event_photo_hidden(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Fotky, které do galerie nahraje pořadatel
-- Soubory: soukromé úložiště event-gallery {event_id}/{photo_id}/{key}-{size}.{format}
-- ---------------------------------------------------------------------
create table public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  photo_key uuid not null,
  photo_format text not null check (photo_format in ('webp', 'jpg')),
  width integer check (width > 0),
  height integer check (height > 0),
  caption text check (char_length(caption) <= 300),
  uploaded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index event_photos_event_idx on public.event_photos (event_id, created_at desc);

alter table public.event_photos enable row level security;

create policy "event_photos: read if event visible"
  on public.event_photos for select
  to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_photos.event_id));

create policy "event_photos: organizer inserts"
  on public.event_photos for insert
  to authenticated
  with check (public.is_event_organizer(event_id) and uploaded_by = (select auth.uid()));

create policy "event_photos: organizer deletes"
  on public.event_photos for delete
  to authenticated
  using (public.is_event_organizer(event_id));

revoke update on public.event_photos from anon, authenticated;
revoke insert, delete on public.event_photos from anon;

create function public.enforce_event_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.event_photos where event_id = new.event_id) >= 300 then
    raise exception 'gallery_limit';
  end if;
  return new;
end;
$$;

create trigger event_photos_limit
  before insert on public.event_photos
  for each row execute function public.enforce_event_photo_limit();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-gallery', 'event-gallery', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "event-gallery: read if event visible"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'event-gallery'
    and exists (select 1 from public.events e where e.id::text = (storage.foldername(objects.name))[1])
  );

create policy "event-gallery: organizer uploads"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-gallery'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(objects.name))[1] and public.is_event_organizer(e.id)
    )
  );

create policy "event-gallery: organizer deletes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-gallery'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(objects.name))[1] and public.is_event_organizer(e.id)
    )
  );

-- ---------------------------------------------------------------------
-- Čtení: práce médií v galerii eventu a fotky od creatorů u auta
-- (jen veřejné profily; skryté v galerii vidí jen pořadatel)
-- ---------------------------------------------------------------------
create function public.event_media_works(p_event_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  kind text,
  photo_key uuid,
  photo_format text,
  video_url text,
  video_provider text,
  caption text,
  hidden boolean,
  created_at timestamptz,
  username text,
  display_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select pi.id, pi.owner_id, pi.kind, pi.photo_key, pi.photo_format, pi.video_url, pi.video_provider,
         pi.caption, pi.hidden_in_event, pi.created_at, p.username, p.display_name
  from public.portfolio_items pi
  join public.profiles p on p.id = pi.owner_id
  where pi.event_id = p_event_id
    and p.visibility = 'public'
    and public.event_is_visible(p_event_id)
    and exists (
      select 1 from public.event_media_requests m
      where m.event_id = p_event_id and m.user_id = pi.owner_id and m.status = 'approved'
    )
    and (not pi.hidden_in_event or public.is_event_organizer(p_event_id))
  order by pi.created_at desc
  limit 300;
$$;

create function public.vehicle_creator_works(p_vehicle_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  kind text,
  photo_key uuid,
  photo_format text,
  video_url text,
  video_provider text,
  caption text,
  created_at timestamptz,
  username text,
  display_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select pi.id, pi.owner_id, pi.kind, pi.photo_key, pi.photo_format, pi.video_url, pi.video_provider,
         pi.caption, pi.created_at, p.username, p.display_name
  from public.portfolio_items pi
  join public.profiles p on p.id = pi.owner_id
  where pi.vehicle_id = p_vehicle_id
    and p.visibility = 'public'
    and public.vehicle_is_visible(p_vehicle_id)
  order by pi.created_at desc
  limit 60;
$$;

revoke execute on function public.event_media_works(uuid) from public;
revoke execute on function public.vehicle_creator_works(uuid) from public;
grant execute on function public.event_media_works(uuid) to anon, authenticated;
grant execute on function public.vehicle_creator_works(uuid) to anon, authenticated;
