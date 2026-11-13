-- =====================================================================
-- CREATOR (fotografové, kameramani, tvůrci reels) – část 1
-- - Typ účtu Creator: přepne si kdokoli sám (profiles.is_creator),
--   zaměření foto / video / dron. Garáž mu zůstává (nepovinná).
-- - Úvodní (cover) fotka pro všechny profily.
-- - Portfolio: fotky (nahrané k nám) a videa (jen odkaz na YouTube,
--   Instagram, TikTok, Vimeo). Na profilu 12 prací (připíchnuté, pak
--   nejnovější), zbytek v Archivu tvorby. Viditelnost = viditelnost profilu.
-- Soubory: soukromé úložiště profile-media
--   {user_id}/cover/{key}-{sm|md|lg}.{format}
--   {user_id}/portfolio/{item_id}/{key}-{sm|md|lg}.{format}
-- =====================================================================

alter table public.profiles
  add column is_creator boolean not null default false,
  add column creator_skills text[] not null default '{}'
    check (creator_skills <@ array['photo', 'video', 'drone']::text[]),
  add column cover_key uuid,
  add column cover_format text check (cover_format in ('webp', 'jpg')),
  add constraint profiles_cover check ((cover_key is null) = (cover_format is null));

grant update (is_creator, creator_skills, cover_key, cover_format) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- Portfolio
-- ---------------------------------------------------------------------
create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  -- fotka (u videa nepovinný vlastní náhled)
  photo_key uuid,
  photo_format text check (photo_format in ('webp', 'jpg')),
  width integer check (width > 0),
  height integer check (height > 0),
  -- video: jen odkaz (aplikace ho ověří a převede na tvar, který umí přehrát)
  video_url text check (video_url ~ '^https://' and char_length(video_url) <= 500),
  video_provider text check (video_provider in ('youtube', 'instagram', 'tiktok', 'vimeo')),
  caption text check (char_length(caption) <= 300),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  constraint portfolio_items_photo_pair check ((photo_key is null) = (photo_format is null)),
  constraint portfolio_items_kind check (
    (kind = 'photo' and photo_key is not null and video_url is null and video_provider is null)
    or (kind = 'video' and video_url is not null and video_provider is not null)
  )
);

create index portfolio_items_owner_idx on public.portfolio_items (owner_id, pinned desc, created_at desc);

alter table public.portfolio_items enable row level security;

-- Číst: své vždy; cizí jen u veřejného profilu
create policy "portfolio_items: read public or own"
  on public.portfolio_items for select
  to anon, authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = portfolio_items.owner_id and p.visibility = 'public'
    )
  );

-- Přidat: jen do svého portfolia a jen jako Creator
create policy "portfolio_items: insert own creator"
  on public.portfolio_items for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_creator
    )
  );

create policy "portfolio_items: update own"
  on public.portfolio_items for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "portfolio_items: delete own"
  on public.portfolio_items for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Měnit jde jen popisek, připíchnutí a vlastní náhled videa
revoke all on public.portfolio_items from anon;
grant select on public.portfolio_items to anon;
revoke update on public.portfolio_items from authenticated;
grant update (caption, pinned, photo_key, photo_format, width, height) on public.portfolio_items to authenticated;

-- Limity: nejvýš 300 prací a 12 připíchnutých
create function public.enforce_portfolio_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     and (select count(*) from public.portfolio_items where owner_id = new.owner_id) >= 300 then
    raise exception 'portfolio_limit';
  end if;
  if new.pinned and (tg_op = 'INSERT' or not old.pinned)
     and (select count(*) from public.portfolio_items
          where owner_id = new.owner_id and pinned and id <> new.id) >= 12 then
    raise exception 'pin_limit';
  end if;
  return new;
end;
$$;

create trigger portfolio_items_limits
  before insert or update of pinned on public.portfolio_items
  for each row execute function public.enforce_portfolio_limits();

-- ---------------------------------------------------------------------
-- Úložiště profile-media (cover + portfolio), soukromé
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

-- Číst: soubory profilu, který čtenář smí vidět (RLS profilů)
create policy "profile-media: read if profile visible"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'profile-media'
    and exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(objects.name))[1]
    )
  );

create policy "profile-media: upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(objects.name))[1] = (select auth.uid())::text
  );

create policy "profile-media: delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(objects.name))[1] = (select auth.uid())::text
  );
