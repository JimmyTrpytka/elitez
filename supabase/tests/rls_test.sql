-- =====================================================================
-- Test pravidel přístupu (RLS) pro profil a garáž.
-- Spouští se příkazem: npm run test:db
-- Vše běží v transakci a na konci se VRÁTÍ (rollback) – v databázi nic nezůstane.
-- Při chybě test skončí hláškou „FAIL: …“.
-- =====================================================================
begin;

-- Dva testovací uživatelé: Alice (soukromé auto) a Bob (cizí uživatel)
insert into auth.users (id, email, aud, role, instance_id)
values
  ('00000000-0000-4000-a000-00000000a11c', 'rls-test-alice@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-4000-a000-000000000b0b', 'rls-test-bob@example.invalid',   'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

do $$ begin
  if (select count(*) from public.profiles where id in (
        '00000000-0000-4000-a000-00000000a11c', '00000000-0000-4000-a000-000000000b0b')) <> 2 then
    raise exception 'FAIL: profil se při registraci nezaložil automaticky';
  end if;
end $$;

-- ---------- Alice ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;

update public.profiles set username = 'rls_alice' where id = auth.uid();

insert into public.vehicles (id, category, make, model, visibility)
values
  ('00000000-0000-4000-b000-00000000000a', 'tuning', 'BMW', 'E30', 'public'),
  ('00000000-0000-4000-b000-00000000000b', 'tuning', 'Audi', 'Tajný projekt', 'private');

insert into public.vehicle_mods (vehicle_id, category, description)
values ('00000000-0000-4000-b000-00000000000b', 'engine', 'Turbo');

insert into public.vehicle_photos (vehicle_id, position)
values ('00000000-0000-4000-b000-00000000000b', 0);

do $$ begin
  if (select count(*) from public.vehicles) < 2 then
    raise exception 'FAIL: majitel nevidí svá vozidla';
  end if;
end $$;

-- Alice nahraje soubor fotky do složky svého soukromého vozidla
insert into storage.objects (bucket_id, name)
values ('vehicle-photos', '00000000-0000-4000-b000-00000000000b/test-sm.webp');

-- Alice si nesmí sama udělit Verified ani roli admin
do $$ begin
  begin
    update public.profiles set verified_at = now() where id = auth.uid();
    raise exception 'FAIL: uživatel si nastavil Verified';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'FAIL: uživatel si nastavil roli admin';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

-- ---------- Bob (cizí uživatel) ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;

do $$ begin
  if exists (select 1 from public.vehicles where id = '00000000-0000-4000-b000-00000000000b') then
    raise exception 'FAIL: cizí uživatel vidí SOUKROMÉ vozidlo';
  end if;
  if exists (select 1 from public.vehicle_mods where vehicle_id = '00000000-0000-4000-b000-00000000000b') then
    raise exception 'FAIL: cizí uživatel vidí úpravy soukromého vozidla';
  end if;
  if exists (select 1 from public.vehicle_photos where vehicle_id = '00000000-0000-4000-b000-00000000000b') then
    raise exception 'FAIL: cizí uživatel vidí fotky soukromého vozidla';
  end if;
  if not exists (select 1 from public.vehicles where id = '00000000-0000-4000-b000-00000000000a') then
    raise exception 'FAIL: cizí uživatel nevidí VEŘEJNÉ vozidlo';
  end if;
  if exists (select 1 from storage.objects
             where name like '00000000-0000-4000-b000-00000000000b/%') then
    raise exception 'FAIL: cizí uživatel vidí SOUBORY fotek soukromého vozidla';
  end if;
  begin
    insert into storage.objects (bucket_id, name)
    values ('vehicle-photos', '00000000-0000-4000-b000-00000000000a/podvrh-sm.webp');
    raise exception 'FAIL: cizí uživatel nahrál soubor k cizímu vozidlu';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Bob nesmí upravit ani smazat cizí vozidlo (příkaz proběhne, ale nic nezmění)
update public.vehicles set model = 'hacked' where id = '00000000-0000-4000-b000-00000000000a';
delete from public.vehicles where id = '00000000-0000-4000-b000-00000000000a';
reset role;

do $$ begin
  if not exists (select 1 from public.vehicles
                 where id = '00000000-0000-4000-b000-00000000000a' and model = 'E30') then
    raise exception 'FAIL: cizí uživatel upravil nebo smazal cizí vozidlo';
  end if;
end $$;

-- Bob nesmí vložit vozidlo za Alici
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    insert into public.vehicles (owner_id, category, make, model)
    values ('00000000-0000-4000-a000-00000000a11c', 'other', 'X', 'Y');
    raise exception 'FAIL: uživatel vložil vozidlo za někoho jiného';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------- Alice přepne profil na soukromý ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
update public.profiles set visibility = 'private' where id = auth.uid();
reset role;

-- Nepřihlášený návštěvník
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if exists (select 1 from public.profiles where username = 'rls_alice') then
    raise exception 'FAIL: návštěvník vidí SOUKROMÝ profil';
  end if;
  if exists (select 1 from public.vehicles where id = '00000000-0000-4000-b000-00000000000a') then
    raise exception 'FAIL: návštěvník vidí vozidlo v soukromém profilu';
  end if;
end $$;
reset role;

-- Limit 20 fotek
do $$
declare i int;
begin
  for i in 2..20 loop
    insert into public.vehicle_photos (vehicle_id, position)
    values ('00000000-0000-4000-b000-00000000000b', i);
  end loop;
  begin
    insert into public.vehicle_photos (vehicle_id, position)
    values ('00000000-0000-4000-b000-00000000000b', 21);
    raise exception 'FAIL: vozidlo má víc než 20 fotek';
  exception when raise_exception then
    if sqlerrm <> 'photo_limit_reached' then raise; end if;
  end;
end $$;

-- =====================================================================
-- Milník 3: pořadatelé a eventy
-- Alice = schválená pořadatelka, Bob = běžný člen (pak pořadatel čekající na schválení)
-- =====================================================================
insert into public.organizers (id, profile_id, name, status)
values ('00000000-0000-4000-c000-00000000000a', '00000000-0000-4000-a000-00000000a11c', 'Alice Events', 'approved');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;

insert into public.seasons (id, organizer_id, name, year)
values ('00000000-0000-4000-d000-00000000000a', '00000000-0000-4000-c000-00000000000a', 'Sezóna 2027', 2027);

insert into public.events
  (id, organizer_id, season_id, slug, title, starts_at, ends_at, status, access,
   registration_opens_at, verified_head_start_hours)
values
  ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-c000-00000000000a', '00000000-0000-4000-d000-00000000000a',
   'rls-koncept', 'Koncept', '2027-05-15 08:00+00', '2027-05-15 20:00+00', 'draft', 'public', null, 0),
  ('00000000-0000-4000-e000-000000000002', '00000000-0000-4000-c000-00000000000a', '00000000-0000-4000-d000-00000000000a',
   'rls-verejny', 'Veřejný', '2027-06-19 08:00+00', '2027-06-20 20:00+00', 'published', 'public',
   '2027-03-01 08:00+00', 24),
  ('00000000-0000-4000-e000-000000000003', '00000000-0000-4000-c000-00000000000a', null,
   'rls-pozvanky', 'Na pozvánky', '2027-07-01 08:00+00', '2027-07-01 20:00+00', 'published', 'invite_only', null, 0),
  ('00000000-0000-4000-e000-000000000004', '00000000-0000-4000-c000-00000000000a', null,
   'rls-verified', 'Jen Verified', '2027-08-01 08:00+00', '2027-08-01 20:00+00', 'published', 'verified_only', null, 0);

do $$ begin
  if (select count(*) from public.events where slug like 'rls-%') <> 4 then
    raise exception 'FAIL: pořadatel nevidí všechny své eventy';
  end if;
  if (select registration_verified_opens_at from public.events where slug = 'rls-verejny')
     <> '2027-02-28 08:00+00'::timestamptz then
    raise exception 'FAIL: termín registrace pro Verified se nespočítal správně';
  end if;
  if (select published_at from public.events where slug = 'rls-verejny') is null then
    raise exception 'FAIL: chybí datum zveřejnění';
  end if;
  -- Pořadatel si nesmí sám změnit stav (schválení)
  begin
    update public.organizers set status = 'approved' where profile_id = auth.uid();
    raise exception 'FAIL: pořadatel změnil stav schválení';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Zveřejněný event smazat nejde (jen koncept)
delete from public.events where slug = 'rls-verejny';
delete from public.events where slug = 'rls-koncept';
reset role;

do $$ begin
  if not exists (select 1 from public.events where slug = 'rls-verejny') then
    raise exception 'FAIL: pořadatel smazal ZVEŘEJNĚNÝ event';
  end if;
  if exists (select 1 from public.events where slug = 'rls-koncept') then
    raise exception 'FAIL: pořadatel nemohl smazat koncept';
  end if;
end $$;

-- Koncept znovu pro další testy
insert into public.events (id, organizer_id, slug, title, starts_at, ends_at, status)
values ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-c000-00000000000a',
        'rls-koncept', 'Koncept', '2027-05-15 08:00+00', '2027-05-15 20:00+00', 'draft');

-- ---------- Bob (běžný člen) ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;

do $$ begin
  if exists (select 1 from public.events where slug = 'rls-koncept') then
    raise exception 'FAIL: cizí uživatel vidí KONCEPT eventu';
  end if;
  if exists (select 1 from public.events where slug = 'rls-pozvanky') then
    raise exception 'FAIL: nepozvaný uživatel vidí event NA POZVÁNKY';
  end if;
  if not exists (select 1 from public.events where slug = 'rls-verejny') then
    raise exception 'FAIL: uživatel nevidí zveřejněný veřejný event';
  end if;
  if not exists (select 1 from public.events where slug = 'rls-verified') then
    raise exception 'FAIL: uživatel nevidí zveřejněný event „jen Verified“';
  end if;
  begin
    insert into public.organizers (profile_id, name) values (auth.uid(), 'Bob');
    raise exception 'FAIL: běžný uživatel se sám udělal pořadatelem';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.events (organizer_id, slug, title, starts_at, ends_at)
    values ('00000000-0000-4000-c000-00000000000a', 'rls-podvrh', 'X', now(), now());
    raise exception 'FAIL: cizí uživatel založil event za pořadatele';
  exception when insufficient_privilege then null;
  end;
end $$;

update public.events set title = 'hacked' where slug = 'rls-verejny';
reset role;

do $$ begin
  if (select title from public.events where slug = 'rls-verejny') <> 'Veřejný' then
    raise exception 'FAIL: cizí uživatel upravil cizí event';
  end if;
end $$;

-- Bob jako pořadatel ČEKAJÍCÍ na schválení zatím nesmí zakládat eventy
insert into public.organizers (id, profile_id, name, status)
values ('00000000-0000-4000-c000-00000000000b', '00000000-0000-4000-a000-000000000b0b', 'Bob Events', 'pending');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    insert into public.events (organizer_id, slug, title, starts_at, ends_at)
    values ('00000000-0000-4000-c000-00000000000b', 'rls-bob', 'Bob', now(), now());
    raise exception 'FAIL: neschválený pořadatel založil event';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.events where slug = 'rls-koncept') then
    raise exception 'FAIL: jiný pořadatel vidí cizí koncept';
  end if;
end $$;
reset role;

-- Nepřihlášený návštěvník vidí jen zveřejněné veřejné / jen Verified
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if (select count(*) from public.events where slug like 'rls-%') <> 2 then
    raise exception 'FAIL: návštěvník vidí jiné eventy, než má';
  end if;
end $$;
reset role;

select 'OK: všechny testy pravidel přístupu prošly' as vysledek;

rollback;
