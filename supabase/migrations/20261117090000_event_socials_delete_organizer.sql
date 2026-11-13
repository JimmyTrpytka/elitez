-- =====================================================================
-- Připomínky testerů (2. kolo)
-- 1) Odkazy na sociální sítě a web u eventu
-- 2) Smazání omylem založeného pořadatele (jen bez eventů)
-- =====================================================================

-- 1) Sociální sítě u eventu (pořadatel je mění stejně jako ostatní údaje eventu)
alter table public.events
  add column website_url text check (website_url ~ '^https?://' and char_length(website_url) <= 200),
  add column instagram_url text check (instagram_url ~ '^https?://' and char_length(instagram_url) <= 200),
  add column facebook_url text check (facebook_url ~ '^https?://' and char_length(facebook_url) <= 200),
  add column tiktok_url text check (tiktok_url ~ '^https?://' and char_length(tiktok_url) <= 200),
  add column youtube_url text check (youtube_url ~ '^https?://' and char_length(youtube_url) <= 200);

-- 2) Smazání pořadatele
-- Smí vlastník (člověk-pořadatel bez ohledu na stav, správce crew-pořadatele)
-- nebo admin. Spolupořadatel ne. Pořadatel s jakýmkoli eventem (i konceptem)
-- smazat nejde – historie eventů se nesmí ztratit.
create function public.delete_organizer(p_organizer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizers;
begin
  select * into v_org from public.organizers where id = p_organizer_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if not (
    public.is_admin()
    or v_org.profile_id = auth.uid()
    or (v_org.crew_id is not null and public.is_crew_manager(v_org.crew_id))
  ) then
    raise exception 'not_allowed';
  end if;
  if exists (select 1 from public.events e where e.organizer_id = p_organizer_id) then
    raise exception 'has_events';
  end if;
  -- sezóny, spolupořadatelé a sledující se smažou s ním (on delete cascade)
  delete from public.organizers where id = p_organizer_id;
end;
$$;

revoke execute on function public.delete_organizer(uuid) from public, anon;
grant execute on function public.delete_organizer(uuid) to authenticated;
