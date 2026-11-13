-- =====================================================================
-- Odkazy na sociální sítě: členové, pořadatelé, crew
-- (web, Instagram, Facebook, TikTok, YouTube). Vždy celé https odkazy;
-- aplikace doplní „@jméno“ na plný odkaz.
-- =====================================================================

-- Členové
alter table public.profiles
  add column website_url text check (website_url ~ '^https?://' and char_length(website_url) <= 200),
  add column instagram_url text check (instagram_url ~ '^https?://' and char_length(instagram_url) <= 200),
  add column facebook_url text check (facebook_url ~ '^https?://' and char_length(facebook_url) <= 200),
  add column tiktok_url text check (tiktok_url ~ '^https?://' and char_length(tiktok_url) <= 200),
  add column youtube_url text check (youtube_url ~ '^https?://' and char_length(youtube_url) <= 200);

grant update (website_url, instagram_url, facebook_url, tiktok_url, youtube_url)
  on public.profiles to authenticated;

-- Pořadatelé (web, Instagram a Facebook už mají)
alter table public.organizers
  add column tiktok_url text check (tiktok_url ~ '^https?://' and char_length(tiktok_url) <= 200),
  add column youtube_url text check (youtube_url ~ '^https?://' and char_length(youtube_url) <= 200);

grant update (tiktok_url, youtube_url) on public.organizers to authenticated;

-- Crew
alter table public.crews
  add column website_url text check (website_url ~ '^https?://' and char_length(website_url) <= 200),
  add column instagram_url text check (instagram_url ~ '^https?://' and char_length(instagram_url) <= 200),
  add column facebook_url text check (facebook_url ~ '^https?://' and char_length(facebook_url) <= 200),
  add column tiktok_url text check (tiktok_url ~ '^https?://' and char_length(tiktok_url) <= 200),
  add column youtube_url text check (youtube_url ~ '^https?://' and char_length(youtube_url) <= 200);

grant update (website_url, instagram_url, facebook_url, tiktok_url, youtube_url)
  on public.crews to authenticated;
