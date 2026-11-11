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

-- =====================================================================
-- Milník 4: přihlášky
-- Alice = pořadatelka, Bob a Carol = uchazeči
-- =====================================================================
insert into auth.users (id, email, aud, role, instance_id)
values ('00000000-0000-4000-a000-0000000ca201', 'rls-test-carol@example.invalid',
        'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
update public.profiles set username = 'rls_bob', visibility = 'private'
where id = '00000000-0000-4000-a000-000000000b0b';
update public.profiles set username = 'rls_carol'
where id = '00000000-0000-4000-a000-0000000ca201';

-- Event s kapacitou 1 a otevřenou registrací; druhý jen pro Verified; třetí ještě neotevřený
insert into public.events
  (id, organizer_id, slug, title, starts_at, ends_at, status, access, capacity,
   registration_opens_at, verified_head_start_hours)
values
  ('00000000-0000-4000-e000-000000000010', '00000000-0000-4000-c000-00000000000a',
   'rls-registrace', 'Registrace', now() + interval '60 days', now() + interval '61 days',
   'published', 'public', 1, now() - interval '1 day', 0),
  ('00000000-0000-4000-e000-000000000011', '00000000-0000-4000-c000-00000000000a',
   'rls-jen-verified-reg', 'Jen Verified', now() + interval '60 days', now() + interval '61 days',
   'published', 'verified_only', null, now() - interval '1 day', 0),
  ('00000000-0000-4000-e000-000000000012', '00000000-0000-4000-c000-00000000000a',
   'rls-neotevreno', 'Neotevřeno', now() + interval '60 days', now() + interval '61 days',
   'published', 'public', null, now() + interval '3 days', 168);

insert into public.vehicles (id, owner_id, category, make, model, visibility)
values
  ('00000000-0000-4000-b000-0000000000b1', '00000000-0000-4000-a000-000000000b0b', 'tuning', 'Škoda', 'Bobova soukromá', 'private'),
  ('00000000-0000-4000-b000-0000000000c1', '00000000-0000-4000-a000-0000000ca201', 'american', 'Ford', 'Mustang', 'public');

-- ---------- Bob se hlásí se soukromým autem ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r public.event_registrations;
begin
  begin
    perform public.register_for_event('00000000-0000-4000-e000-000000000010',
      '00000000-0000-4000-b000-0000000000b1', '+420777111222', 'bob@example.invalid', null, true, false);
    raise exception 'FAIL: soukromé auto přihlášené bez potvrzení';
  exception when raise_exception then
    if sqlerrm <> 'private_ack_required' then raise; end if;
  end;
  begin
    perform public.register_for_event('00000000-0000-4000-e000-000000000010',
      '00000000-0000-4000-b000-0000000000c1', '+420777111222', 'bob@example.invalid', null, true, true);
    raise exception 'FAIL: uživatel přihlásil cizí auto';
  exception when raise_exception then
    if sqlerrm <> 'vehicle_invalid' then raise; end if;
  end;
  r := public.register_for_event('00000000-0000-4000-e000-000000000010',
    '00000000-0000-4000-b000-0000000000b1', '+420777111222', 'bob@example.invalid', 'Ahoj', true, true);
  if r.status <> 'pending' then raise exception 'FAIL: nová přihláška není „čeká“'; end if;
  begin
    perform public.register_for_event('00000000-0000-4000-e000-000000000010',
      '00000000-0000-4000-b000-0000000000b1', '+420777111222', 'bob@example.invalid', null, true, true);
    raise exception 'FAIL: stejné auto přihlášené dvakrát';
  exception when raise_exception then
    if sqlerrm <> 'already_registered' then raise; end if;
  end;
  begin
    insert into public.event_registrations (event_id, vehicle_id, user_id, status, contact_phone, contact_email)
    values ('00000000-0000-4000-e000-000000000010', '00000000-0000-4000-b000-0000000000b1',
            auth.uid(), 'approved', '+420777111222', 'bob@example.invalid');
    raise exception 'FAIL: uživatel zapsal přihlášku přímo do tabulky';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.decide_registration(r.id, 'approved');
    raise exception 'FAIL: uchazeč si sám schválil přihlášku';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
  begin
    perform public.register_for_event('00000000-0000-4000-e000-000000000011',
      '00000000-0000-4000-b000-0000000000b1', '+420777111222', 'bob@example.invalid', null, true, true);
    raise exception 'FAIL: neověřený člen se přihlásil na event jen pro Verified';
  exception when raise_exception then
    if sqlerrm <> 'verified_only' then raise; end if;
  end;
  begin
    perform public.register_for_event('00000000-0000-4000-e000-000000000012',
      '00000000-0000-4000-b000-0000000000b1', '+420777111222', 'bob@example.invalid', null, true, true);
    raise exception 'FAIL: přihláška před otevřením registrace';
  exception when raise_exception then
    if sqlerrm <> 'not_open_yet' then raise; end if;
  end;
end $$;
reset role;

-- ---------- Alice (pořadatelka) vidí přihlášku, soukromé auto i soukromý profil ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_reg uuid; r public.event_registrations;
begin
  select id into v_reg from public.event_registrations
  where event_id = '00000000-0000-4000-e000-000000000010';
  if v_reg is null then raise exception 'FAIL: pořadatel nevidí přihlášku na svůj event'; end if;
  if not exists (select 1 from public.vehicles where id = '00000000-0000-4000-b000-0000000000b1') then
    raise exception 'FAIL: pořadatel nevidí soukromé auto uchazeče';
  end if;
  if not exists (select 1 from public.profiles where username = 'rls_bob') then
    raise exception 'FAIL: pořadatel nevidí soukromý profil uchazeče';
  end if;
  insert into public.event_registration_notes (registration_id, note) values (v_reg, 'Pěkné auto');
  r := public.decide_registration(v_reg, 'approved');
  if r.status <> 'approved' then raise exception 'FAIL: schválení nefunguje'; end if;
end $$;
reset role;

-- ---------- Bob nevidí interní poznámku; Carol nevidí Bobovu přihlášku ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.event_registration_notes) then
    raise exception 'FAIL: uchazeč vidí interní poznámku pořadatele';
  end if;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000ca201","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r public.event_registrations;
begin
  if exists (select 1 from public.event_registrations where user_id <> auth.uid()) then
    raise exception 'FAIL: uchazeč vidí cizí přihlášky';
  end if;
  if exists (select 1 from public.vehicles where id = '00000000-0000-4000-b000-0000000000b1') then
    raise exception 'FAIL: jiný uchazeč vidí soukromé auto';
  end if;
  -- Kapacita 1 je plná → Carol jde na čekací listinu
  r := public.register_for_event('00000000-0000-4000-e000-000000000010',
    '00000000-0000-4000-b000-0000000000c1', '+420777333444', 'carol@example.invalid', null, true, false);
  if r.status <> 'waitlist' then raise exception 'FAIL: při plné kapacitě nejde přihláška na čekací listinu'; end if;
end $$;
reset role;

-- ---------- Bob zruší schválenou přihlášku → Carol se automaticky schválí ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_reg uuid;
begin
  select id into v_reg from public.event_registrations
  where event_id = '00000000-0000-4000-e000-000000000010' and user_id = auth.uid();
  perform public.cancel_registration(v_reg);
end $$;
reset role;

do $$ begin
  if (select status from public.event_registrations
      where vehicle_id = '00000000-0000-4000-b000-0000000000c1') <> 'approved' then
    raise exception 'FAIL: po uvolnění místa se nedoplnilo z čekací listiny';
  end if;
end $$;

-- ---------- Schválení při plné kapacitě → čekací listina ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r public.event_registrations;
begin
  r := public.register_for_event('00000000-0000-4000-e000-000000000010',
    '00000000-0000-4000-b000-0000000000b1', '+420777111222', 'bob@example.invalid', null, true, true);
  if r.status <> 'waitlist' then raise exception 'FAIL: druhá přihláška při plné kapacitě není na listině'; end if;
  -- Auto s historií na eventu nejde smazat
  delete from public.vehicles where id = '00000000-0000-4000-b000-0000000000b1';
end $$;
reset role;

do $$ begin
  if not exists (select 1 from public.vehicles where id = '00000000-0000-4000-b000-0000000000b1') then
    raise exception 'FAIL: smazáno vozidlo, které bylo přihlášené na event';
  end if;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_reg uuid; r public.event_registrations;
begin
  select id into v_reg from public.event_registrations
  where vehicle_id = '00000000-0000-4000-b000-0000000000b1' and status = 'waitlist';
  r := public.decide_registration(v_reg, 'approved');
  if r.status <> 'waitlist' then raise exception 'FAIL: schválení přeplnilo kapacitu'; end if;
  -- Zamítnutí schválené Carol → Bob se doplní z listiny
  select id into v_reg from public.event_registrations
  where vehicle_id = '00000000-0000-4000-b000-0000000000c1';
  r := public.decide_registration(v_reg, 'rejected', 'criteria', 'Díky, letos ne.');
  if r.status <> 'rejected' or r.rejection_reason <> 'criteria' then
    raise exception 'FAIL: zamítnutí s důvodem nefunguje';
  end if;
  if (select status from public.event_registrations
      where vehicle_id = '00000000-0000-4000-b000-0000000000b1' and status <> 'cancelled') <> 'approved' then
    raise exception 'FAIL: po zamítnutí schváleného se nedoplnilo z listiny';
  end if;
end $$;
reset role;

-- Nepřihlášený návštěvník nevidí žádné přihlášky
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  begin
    if exists (select 1 from public.event_registrations) then
      raise exception 'FAIL: návštěvník vidí přihlášky';
    end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- =====================================================================
-- Milník 5: upozornění, fronta e-mailů, hromadné zprávy
-- =====================================================================
do $$ begin
  if not exists (select 1 from public.notifications
                 where user_id = '00000000-0000-4000-a000-0000000ca201' and type = 'registration_promoted') then
    raise exception 'FAIL: chybí upozornění o posunu z čekací listiny';
  end if;
  if not exists (select 1 from public.notifications
                 where user_id = '00000000-0000-4000-a000-0000000ca201' and type = 'registration_rejected'
                   and payload ->> 'reason' = 'criteria') then
    raise exception 'FAIL: chybí upozornění o zamítnutí s důvodem';
  end if;
  if not exists (select 1 from public.email_outbox
                 where to_email = 'rls-test-carol@example.invalid' and template = 'registration_rejected') then
    raise exception 'FAIL: e-mail o zamítnutí není ve frontě';
  end if;
  if exists (select 1 from public.email_outbox
             where to_email = 'rls-test-bob@example.invalid' and template = 'registration_cancelled') then
    raise exception 'FAIL: zrušení vlastní přihlášky nemá posílat e-mail';
  end if;
end $$;

-- Bob vidí jen svá upozornění, frontu e-mailů nevidí, nic nevkládá
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.notifications where user_id <> auth.uid()) then
    raise exception 'FAIL: uživatel vidí cizí upozornění';
  end if;
  if not exists (select 1 from public.notifications where user_id = auth.uid()) then
    raise exception 'FAIL: uživatel nevidí svá upozornění';
  end if;
  update public.notifications set read_at = now() where user_id = auth.uid();
  begin
    perform 1 from public.email_outbox limit 1;
    raise exception 'FAIL: uživatel čte frontu e-mailů';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.notifications (user_id, type) values (auth.uid(), 'broadcast');
    raise exception 'FAIL: uživatel vložil upozornění';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claim_email_batch(10, 100);
    raise exception 'FAIL: uživatel spustil odesílání fronty';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.send_broadcast('00000000-0000-4000-e000-000000000010', 'approved', 'X', 'Y');
    raise exception 'FAIL: uchazeč poslal hromadnou zprávu';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
reset role;

-- Alice pošle hromadnou zprávu schváleným (Bob je schválený)
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
do $$
declare b public.message_broadcasts; i int;
begin
  if public.broadcast_recipient_count('00000000-0000-4000-e000-000000000010', 'approved') <> 1 then
    raise exception 'FAIL: špatný počet příjemců hromadné zprávy';
  end if;
  b := public.send_broadcast('00000000-0000-4000-e000-000000000010', 'approved',
                             'Info před akcí', 'Ahoj {jmeno}, vjezd od 8:00.');
  if b.recipient_count <> 1 then raise exception 'FAIL: hromadná zpráva nemá 1 příjemce'; end if;
  for i in 2..5 loop
    perform public.send_broadcast('00000000-0000-4000-e000-000000000010', 'approved', 'Info', 'Text');
  end loop;
  begin
    perform public.send_broadcast('00000000-0000-4000-e000-000000000010', 'approved', 'Info', 'Text');
    raise exception 'FAIL: překročen denní limit hromadných zpráv';
  exception when raise_exception then
    if sqlerrm <> 'daily_limit' then raise; end if;
  end;
end $$;
reset role;

do $$ begin
  if not exists (select 1 from public.notifications
                 where user_id = '00000000-0000-4000-a000-000000000b0b' and type = 'broadcast') then
    raise exception 'FAIL: hromadná zpráva nedorazila do upozornění';
  end if;
  if exists (select 1 from public.notifications
             where user_id = '00000000-0000-4000-a000-0000000ca201' and type = 'broadcast') then
    raise exception 'FAIL: hromadná zpráva dorazila i mimo vybranou skupinu';
  end if;
end $$;

-- =====================================================================
-- Testovací provoz: připomínky
-- =====================================================================
update public.profiles set role = 'admin' where id = '00000000-0000-4000-a000-00000000a11c';
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  perform public.submit_feedback('Nejde mi nahrát fotka', '/cs/garage', 'host@example.invalid', 'test');
  begin
    perform 1 from public.feedback limit 1;
    raise exception 'FAIL: návštěvník čte připomínky';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.submit_feedback('Chybí mi tlačítko zpět', '/cs/account', null, 'test');
  if exists (select 1 from public.feedback) then
    raise exception 'FAIL: běžný uživatel vidí připomínky';
  end if;
  begin
    perform public.submit_feedback('x', '/', null, 'test');
    raise exception 'FAIL: prošla prázdná připomínka';
  exception when raise_exception then
    if sqlerrm <> 'invalid_message' then raise; end if;
  end;
end $$;
reset role;

-- Admin připomínky vidí
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.feedback where user_agent = 'test') <> 2 then
    raise exception 'FAIL: admin nevidí připomínky';
  end if;
end $$;
reset role;

do $$ begin
  if not exists (select 1 from public.email_outbox
                 where template = 'feedback' and to_email = 'rls-test-alice@example.invalid') then
    raise exception 'FAIL: admin nedostal e-mail o připomínce';
  end if;
end $$;

-- =====================================================================
-- Správa uživatelů a seznam členů
-- (Alice je teď admin, Bob běžný člen se soukromým profilem, Carol veřejná)
-- =====================================================================
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform public.admin_list_users(null, 10);
    raise exception 'FAIL: běžný člen vidí seznam uživatelů';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
  begin
    perform public.admin_set_admin(auth.uid(), true);
    raise exception 'FAIL: běžný člen se sám udělal adminem';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if exists (select 1 from public.public_members(null, 100, 0) where username = 'rls_bob') then
    raise exception 'FAIL: soukromý profil je v seznamu členů';
  end if;
  if not exists (select 1 from public.public_members('rls_carol', 100, 0)) then
    raise exception 'FAIL: veřejný profil chybí v seznamu členů';
  end if;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.admin_list_users('rls_bob', 10) where email = 'rls-test-bob@example.invalid') then
    raise exception 'FAIL: admin nevidí uživatele s e-mailem';
  end if;
  -- Carol pořadatelkou → pak odebrat (pozastavit, nesmazat)
  perform public.admin_set_organizer('00000000-0000-4000-a000-0000000ca201', true);
  if (select status from public.organizers where profile_id = '00000000-0000-4000-a000-0000000ca201') <> 'approved' then
    raise exception 'FAIL: udělení role pořadatele nefunguje';
  end if;
  perform public.admin_set_organizer('00000000-0000-4000-a000-0000000ca201', false);
  if (select status from public.organizers where profile_id = '00000000-0000-4000-a000-0000000ca201') <> 'suspended' then
    raise exception 'FAIL: odebrání role pořadatele má profil pozastavit';
  end if;
  perform public.admin_set_admin('00000000-0000-4000-a000-0000000ca201', true);
  if (select role from public.profiles where id = '00000000-0000-4000-a000-0000000ca201') <> 'admin' then
    raise exception 'FAIL: udělení role admina nefunguje';
  end if;
  begin
    perform public.admin_set_admin(auth.uid(), false);
    raise exception 'FAIL: admin si sám odebral roli';
  exception when raise_exception then
    if sqlerrm <> 'cannot_demote_self' then raise; end if;
  end;
end $$;
reset role;

-- =====================================================================
-- Milník 5b: turba, sledování, odznaky, Garáž snů
-- Carol = veřejný profil s veřejným Mustangem, Bob = soukromý profil
-- =====================================================================
insert into public.vehicle_photos (id, vehicle_id, position)
values ('00000000-0000-4000-f000-0000000000c1', '00000000-0000-4000-b000-0000000000c1', 0);

-- Testovací odznaky s nízkou hranicí; Objevitel už od 1 turba
insert into public.badges (code, category, icon, rarity, is_unique, threshold, name_cs, name_en, description_cs, description_en)
values
  ('rls_test_given', 'turbo_given', 'fan', 'common', false, 1, 'T', 'T', '', ''),
  ('rls_test_unique', 'turbo_received', 'crown', 'legendary', true, 1, 'U', 'U', '', '');
update public.badges set threshold = 1 where code = 'discoverer';

-- ---------- Bob dává turba a sleduje ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r record;
begin
  select * into r from public.toggle_turbo(p_photo_id => '00000000-0000-4000-f000-0000000000c1');
  if not r.given or r.total <> 1 then raise exception 'FAIL: turbo na fotku se nepřidalo'; end if;
  select * into r from public.toggle_turbo(p_photo_id => '00000000-0000-4000-f000-0000000000c1');
  if r.given or r.total <> 0 then raise exception 'FAIL: turbo se opakovaným klepnutím neodebralo'; end if;
  select * into r from public.toggle_turbo(p_photo_id => '00000000-0000-4000-f000-0000000000c1');
  if not r.given or r.total <> 1 then raise exception 'FAIL: turbo nejde dát znovu'; end if;
  select * into r from public.toggle_turbo(p_profile_id => '00000000-0000-4000-a000-0000000ca201');
  if not r.given then raise exception 'FAIL: turbo na garáž se nepřidalo'; end if;

  begin
    insert into public.turbos (giver_id, receiver_id, profile_id)
    values (auth.uid(), '00000000-0000-4000-a000-0000000ca201', '00000000-0000-4000-a000-0000000ca201');
    raise exception 'FAIL: turbo jde zapsat přímo do tabulky';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.user_badges (user_id, badge_code) values (auth.uid(), 'turbo_gold');
    raise exception 'FAIL: uživatel si sám udělil odznak';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_award_badge(auth.uid(), 'garage_of_year');
    raise exception 'FAIL: běžný člen udělil odznak';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;

  select * into r from public.toggle_follow('00000000-0000-4000-a000-0000000ca201');
  if not r.following or r.followers <> 1 then raise exception 'FAIL: sledování nefunguje'; end if;
  select * into r from public.toggle_follow('00000000-0000-4000-a000-0000000ca201');
  if r.following or r.followers <> 0 then raise exception 'FAIL: zrušení sledování nefunguje'; end if;
  perform public.toggle_follow('00000000-0000-4000-a000-0000000ca201');
  begin
    insert into public.follows (follower_id, following_id) values (auth.uid(), '00000000-0000-4000-a000-0000000ca201');
    raise exception 'FAIL: sledování jde zapsat přímo do tabulky';
  exception when insufficient_privilege then null;
  end;

  if not exists (select 1 from public.user_badges where user_id = auth.uid() and badge_code = 'rls_test_given') then
    raise exception 'FAIL: odznak za daná turba se neudělil';
  end if;
  if not exists (select 1 from public.user_badges where user_id = auth.uid() and badge_code = 'discoverer') then
    raise exception 'FAIL: odznak Objevitel se neudělil';
  end if;
  if not exists (select 1 from public.notifications where user_id = auth.uid() and type = 'badge_awarded') then
    raise exception 'FAIL: chybí upozornění na nový odznak';
  end if;
  if (select count(*) from public.turbos) <> 2 then
    raise exception 'FAIL: dárce nevidí svá turba';
  end if;

  -- Garáž snů: odkaz na cizí veřejné auto ano, na vlastní ne
  insert into public.dream_cars (owner_id, make, model, linked_vehicle_id)
  values (auth.uid(), 'Ford', 'Mustang', '00000000-0000-4000-b000-0000000000c1');
  begin
    insert into public.dream_cars (owner_id, make, model, linked_vehicle_id)
    values (auth.uid(), 'Škoda', 'Vlastní', '00000000-0000-4000-b000-0000000000b1');
    raise exception 'FAIL: do Garáže snů jde přidat vlastní auto';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.dream_cars (owner_id, make, model)
    values ('00000000-0000-4000-a000-0000000ca201', 'Cizí', 'Sen');
    raise exception 'FAIL: jde zapsat sen za jiného člena';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------- Carol (příjemce) ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000ca201","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n record;
begin
  begin
    perform public.toggle_turbo(p_photo_id => '00000000-0000-4000-f000-0000000000c1');
    raise exception 'FAIL: turbo jde dát vlastní fotce';
  exception when raise_exception then
    if sqlerrm <> 'own_content' then raise; end if;
  end;
  begin
    perform public.toggle_turbo(p_profile_id => '00000000-0000-4000-a000-000000000b0b');
    raise exception 'FAIL: turbo jde dát soukromé garáži';
  exception when raise_exception then
    if sqlerrm <> 'not_found' then raise; end if;
  end;
  begin
    perform public.toggle_follow('00000000-0000-4000-a000-000000000b0b');
    raise exception 'FAIL: jde sledovat soukromý profil';
  exception when raise_exception then
    if sqlerrm <> 'not_found' then raise; end if;
  end;

  -- Souhrnné upozornění: jedno na auto, opakované klepnutí stejného člověka se nepočítá
  if (select count(*) from public.notifications where type = 'turbo_received'
        and payload ->> 'key' = '00000000-0000-4000-b000-0000000000c1') <> 1 then
    raise exception 'FAIL: upozornění na turba se neslučují';
  end if;
  select * into n from public.notifications where type = 'turbo_received'
    and payload ->> 'key' = '00000000-0000-4000-b000-0000000000c1';
  if (n.payload ->> 'count')::integer <> 1 then
    raise exception 'FAIL: opakované turbo od stejného člověka se započítalo dvakrát';
  end if;
  if jsonb_array_length(n.payload -> 'givers') <> 0 then
    raise exception 'FAIL: upozornění prozradilo jméno soukromého profilu';
  end if;
  if (select count(*) from public.notifications where type = 'new_follower') <> 1 then
    raise exception 'FAIL: upozornění na sledování chybí nebo se opakuje';
  end if;
  if not exists (select 1 from public.user_badges where user_id = auth.uid() and badge_code = 'rls_test_unique') then
    raise exception 'FAIL: odznak za získaná turba se neudělil';
  end if;
  if exists (select 1 from public.turbos) then
    raise exception 'FAIL: příjemce vidí řádky turb jiných lidí';
  end if;

  -- Carol nesmí odkázat na Bobovo soukromé auto
  begin
    insert into public.dream_cars (owner_id, make, model, linked_vehicle_id)
    values (auth.uid(), 'Škoda', 'Tajná', '00000000-0000-4000-b000-0000000000b1');
    raise exception 'FAIL: do Garáže snů jde odkázat na soukromé auto';
  exception when insufficient_privilege then null;
  end;
  insert into public.dream_cars (owner_id, make, model, status) values (auth.uid(), 'Porsche', '911', 'searching');
  insert into public.dream_cars (owner_id, make, model, visibility) values (auth.uid(), 'Ferrari', 'F40', 'private');
  update public.dream_cars set note = 'cizí' where owner_id = '00000000-0000-4000-a000-000000000b0b';
  -- Fotku snu jde nahrát jen do vlastní složky a k vlastnímu snu
  insert into storage.objects (bucket_id, name)
  select 'dream-photos', auth.uid()::text || '/' || id::text || '/k-sm.webp'
  from public.dream_cars where owner_id = auth.uid() and make = 'Porsche';
  begin
    insert into storage.objects (bucket_id, name)
    select 'dream-photos', '00000000-0000-4000-a000-000000000b0b/' || id::text || '/k-sm.webp'
    from public.dream_cars where owner_id = auth.uid() and make = 'Porsche';
    raise exception 'FAIL: fotku snu jde nahrát do cizí složky';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.dream_cars where note = 'cizí') then
    raise exception 'FAIL: jde upravit cizí sen';
  end if;
end $$;
reset role;

-- Unikátní odznak už nikdo další nedostane
do $$ begin
  if public.award_badge('00000000-0000-4000-a000-000000000b0b', 'rls_test_unique') then
    raise exception 'FAIL: unikátní odznak získal druhý člověk';
  end if;
  if public.user_streak('00000000-0000-4000-a000-000000000b0b') <> 1 then
    raise exception 'FAIL: denní série se nepočítá';
  end if;
end $$;

-- ---------- Nepřihlášený návštěvník ----------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare s record;
begin
  select * into s from public.profile_social_stats('00000000-0000-4000-a000-0000000ca201');
  if s.garage_turbos <> 2 or s.profile_turbos <> 1 or s.followers <> 1 then
    raise exception 'FAIL: statistiky garáže nesedí (%)', row_to_json(s);
  end if;
  if exists (select 1 from public.profile_social_stats('00000000-0000-4000-a000-000000000b0b')) then
    raise exception 'FAIL: statistiky soukromého profilu jsou veřejné';
  end if;
  if (select turbos from public.photo_turbo_stats(array['00000000-0000-4000-f000-0000000000c1'::uuid])) <> 1 then
    raise exception 'FAIL: počet turb fotky nesedí';
  end if;
  if (select dreamers from public.vehicle_social_stats(array['00000000-0000-4000-b000-0000000000c1'::uuid])) <> 1 then
    raise exception 'FAIL: „v garáži snů u N lidí“ nesedí';
  end if;
  if exists (select 1 from public.vehicle_social_stats(array['00000000-0000-4000-b000-0000000000b1'::uuid])) then
    raise exception 'FAIL: statistiky soukromého vozidla jsou veřejné';
  end if;
  if exists (select 1 from public.turbo_givers(p_photo_id => '00000000-0000-4000-f000-0000000000c1')) then
    raise exception 'FAIL: seznam dárců ukazuje soukromý profil';
  end if;
  if not exists (select 1 from public.leaderboard_vehicles('week', 100)
                 where vehicle_id = '00000000-0000-4000-b000-0000000000c1' and turbos = 1) then
    raise exception 'FAIL: auto chybí v žebříčku';
  end if;
  if not exists (select 1 from public.leaderboard_garages('all', 100) where username = 'rls_carol' and turbos = 2) then
    raise exception 'FAIL: garáž chybí v žebříčku';
  end if;
  if exists (select 1 from public.leaderboard_fans('all', 100) where username = 'rls_bob') then
    raise exception 'FAIL: soukromý profil je v žebříčku fanoušků';
  end if;
  if not exists (select 1 from public.user_badges ub join public.profiles p on p.id = ub.user_id where p.username = 'rls_carol') then
    raise exception 'FAIL: odznaky veřejného profilu nejsou vidět';
  end if;
  if exists (select 1 from public.user_badges where user_id = '00000000-0000-4000-a000-000000000b0b') then
    raise exception 'FAIL: odznaky soukromého profilu jsou vidět';
  end if;
  if (select count(*) from public.dream_cars where owner_id = '00000000-0000-4000-a000-0000000ca201') <> 1 then
    raise exception 'FAIL: návštěvník má vidět jen veřejné sny';
  end if;
  if exists (select 1 from public.dream_cars where owner_id = '00000000-0000-4000-a000-000000000b0b') then
    raise exception 'FAIL: sny soukromého profilu jsou vidět';
  end if;
  if exists (select 1 from public.turbos) or exists (select 1 from public.follows) then
    raise exception 'FAIL: návštěvník čte turba nebo sledování přímo';
  end if;
end $$;
reset role;

-- ---------- Admin (Alice) udělí ruční odznak ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if not public.admin_award_badge('00000000-0000-4000-a000-0000000ca201', 'garage_of_year', '2026') then
    raise exception 'FAIL: admin neudělil ruční odznak';
  end if;
  if public.admin_award_badge('00000000-0000-4000-a000-0000000ca201', 'garage_of_year', '2026') then
    raise exception 'FAIL: stejný odznak se udělil dvakrát';
  end if;
end $$;
reset role;

select 'OK: všechny testy pravidel přístupu prošly' as vysledek;

rollback;
