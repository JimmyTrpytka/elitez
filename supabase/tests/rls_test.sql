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

-- =====================================================================
-- Milník 5c: pořadatelé – profil, sledování, naplánovaná upozornění
-- Alice = pořadatel „Alice Events“, Bob sleduje
-- =====================================================================
do $$ begin
  if (select slug from public.organizers where id = '00000000-0000-4000-c000-00000000000a') <> 'alice-events' then
    raise exception 'FAIL: pořadatel nedostal adresu z názvu';
  end if;
  if public.slugify('Žluťoučký kůň – Ostrava 2027!') <> 'zlutoucky-kun-ostrava-2027' then
    raise exception 'FAIL: adresa z názvu neodstraní diakritiku';
  end if;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r record;
begin
  select * into r from public.toggle_organizer_follow('00000000-0000-4000-c000-00000000000a');
  if not r.following or r.followers <> 1 then raise exception 'FAIL: sledování pořadatele nefunguje'; end if;
  begin
    insert into public.organizer_follows (follower_id, organizer_id)
    values (auth.uid(), '00000000-0000-4000-c000-00000000000a');
    raise exception 'FAIL: sledování pořadatele jde zapsat přímo';
  exception when insufficient_privilege then null;
  end;
  update public.organizers set slug = 'ukradeno', show_past_events = false
  where id = '00000000-0000-4000-c000-00000000000a';
  if (select slug from public.organizers where id = '00000000-0000-4000-c000-00000000000a') <> 'alice-events' then
    raise exception 'FAIL: cizí člověk změnil profil pořadatele';
  end if;
end $$;
reset role;

-- Alice zveřejní event s registrací za 2 dny
insert into public.events
  (id, organizer_id, slug, title, starts_at, ends_at, status, access, registration_opens_at)
values
  ('00000000-0000-4000-e000-000000000050', '00000000-0000-4000-c000-00000000000a',
   'rls-novinka', 'Novinka', now() + interval '30 days', now() + interval '31 days',
   'published', 'public', now() + interval '2 days');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.notifications
                 where type = 'organizer_event_published' and event_id = '00000000-0000-4000-e000-000000000050') then
    raise exception 'FAIL: sledující nedostal upozornění na nový event';
  end if;
  if exists (select 1 from public.notifications
             where type = 'organizer_registration_open' and event_id = '00000000-0000-4000-e000-000000000050') then
    raise exception 'FAIL: upozornění na otevření registrace je vidět předčasně';
  end if;
  update public.notifications set read_at = now() where user_id = auth.uid();
end $$;
reset role;

do $$ begin
  if not exists (select 1 from public.notifications
                 where user_id = '00000000-0000-4000-a000-000000000b0b'
                   and type = 'organizer_registration_open'
                   and event_id = '00000000-0000-4000-e000-000000000050'
                   and visible_from > now() and read_at is null) then
    raise exception 'FAIL: otevření registrace se nenaplánovalo (nebo se označilo jako přečtené)';
  end if;
end $$;

-- Zrušení eventu: naplánované upozornění zmizí, přijde „zrušeno“
update public.events set status = 'cancelled' where id = '00000000-0000-4000-e000-000000000050';
do $$ begin
  if exists (select 1 from public.notifications
             where type = 'organizer_registration_open' and event_id = '00000000-0000-4000-e000-000000000050') then
    raise exception 'FAIL: po zrušení eventu zůstalo naplánované upozornění';
  end if;
  if not exists (select 1 from public.notifications
                 where user_id = '00000000-0000-4000-a000-000000000b0b'
                   and type = 'organizer_event_cancelled' and event_id = '00000000-0000-4000-e000-000000000050') then
    raise exception 'FAIL: sledující nedostal upozornění na zrušení';
  end if;
end $$;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if not exists (select 1 from public.public_organizers() where slug = 'alice-events' and followers = 1) then
    raise exception 'FAIL: pořadatel chybí ve veřejném seznamu';
  end if;
  if (select followers from public.organizer_social_stats('00000000-0000-4000-c000-00000000000a')) <> 1 then
    raise exception 'FAIL: počet sledujících pořadatele nesedí';
  end if;
end $$;
reset role;

-- =====================================================================
-- Milník 5d: Crew
-- Carol (veřejná) zakládá, Bob (soukromý, bez Verified) se přidává, Alice = admin
-- =====================================================================
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform public.admin_set_verified(auth.uid(), true);
    raise exception 'FAIL: běžný člen si udělil Verified';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
  begin
    perform public.create_crew('Bobova crew');
    raise exception 'FAIL: crew založil člověk bez Verified';
  exception when raise_exception then
    if sqlerrm <> 'verified_required' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
select public.admin_set_verified('00000000-0000-4000-a000-0000000ca201', true);
select public.admin_set_verified(auth.uid(), true);
reset role;

-- Carol založí crew (čeká na schválení)
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000ca201","role":"authenticated"}', true);
set local role authenticated;
select set_config('rls.crew_id', public.create_crew('Audi RS6 Fans Praha', 'Popis', 'Audi RS · Praha', 'approval')::text, true);
do $$ begin
  begin
    perform public.create_crew('Druhá crew');
    raise exception 'FAIL: jde mít dvě crew čekající na schválení';
  exception when raise_exception then
    if sqlerrm <> 'pending_exists' then raise; end if;
  end;
  begin
    insert into public.crews (slug, name, name_key, founder_id, status)
    values ('falesna', 'Falešná', 'falesna', auth.uid(), 'approved');
    raise exception 'FAIL: crew jde zapsat přímo (obejít schválení)';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Alice nesmí založit stejný název (jen jinak napsaný)
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform public.create_crew('audi  RS6 fans – praha');
    raise exception 'FAIL: vznikla crew se stejným názvem';
  exception when raise_exception then
    if sqlerrm <> 'name_taken' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if exists (select 1 from public.public_crews() where name = 'Audi RS6 Fans Praha') then
    raise exception 'FAIL: neschválená crew je veřejně vidět';
  end if;
  if exists (select 1 from public.crews where name = 'Audi RS6 Fans Praha') then
    raise exception 'FAIL: neschválenou crew jde přečíst z tabulky';
  end if;
end $$;
reset role;

-- Admin schválí
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
select public.admin_set_crew_status(current_setting('rls.crew_id')::uuid, 'approved');
reset role;

do $$ begin
  if not exists (select 1 from public.notifications
                 where user_id = '00000000-0000-4000-a000-0000000ca201' and type = 'crew_approved') then
    raise exception 'FAIL: zakladatel nedostal upozornění o schválení';
  end if;
  if not exists (select 1 from public.user_badges
                 where user_id = '00000000-0000-4000-a000-0000000ca201' and badge_code = 'crew_founder') then
    raise exception 'FAIL: zakladatel nedostal odznak';
  end if;
  if not exists (select 1 from public.crew_members
                 where user_id = '00000000-0000-4000-a000-0000000ca201' and is_home) then
    raise exception 'FAIL: crew se zakladateli nenastavila jako domovská';
  end if;
end $$;

-- Bob požádá o vstup
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if public.join_crew(current_setting('rls.crew_id')::uuid) <> 'pending' then
    raise exception 'FAIL: vstup do crew se schválením má čekat';
  end if;
  begin
    insert into public.crew_members (crew_id, user_id, status) values (current_setting('rls.crew_id')::uuid, auth.uid(), 'active');
    raise exception 'FAIL: členství jde zapsat přímo';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.crews set name = 'Ukradená' where id = current_setting('rls.crew_id')::uuid;
    raise exception 'FAIL: jde přejmenovat crew';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.decide_crew_member(current_setting('rls.crew_id')::uuid, auth.uid(), 'approve');
    raise exception 'FAIL: člověk si sám schválil vstup';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if exists (select 1 from public.crew_member_list(current_setting('rls.crew_id')::uuid, true) where username = 'rls_bob') then
    raise exception 'FAIL: veřejnost vidí žádost / soukromého člena';
  end if;
  if not exists (select 1 from public.crew_member_list(current_setting('rls.crew_id')::uuid) where username = 'rls_carol') then
    raise exception 'FAIL: veřejnost nevidí zakladatele';
  end if;
end $$;
reset role;

-- Carol (zakladatelka) žádost vidí a schválí
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000ca201","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.crew_member_list(current_setting('rls.crew_id')::uuid, true)
                 where username = 'rls_bob' and status = 'pending') then
    raise exception 'FAIL: zakladatel nevidí žádost o vstup';
  end if;
  if (select pending from public.crew_stats(current_setting('rls.crew_id')::uuid)) <> 1 then
    raise exception 'FAIL: počet žádostí nesedí';
  end if;
  perform public.decide_crew_member(current_setting('rls.crew_id')::uuid, '00000000-0000-4000-a000-000000000b0b', 'approve');
  update public.crews set description = 'Nový popis' where id = current_setting('rls.crew_id')::uuid;
  if (select description from public.crews where id = current_setting('rls.crew_id')::uuid) <> 'Nový popis' then
    raise exception 'FAIL: zakladatel nemůže upravit popis';
  end if;
  begin
    perform public.leave_crew(current_setting('rls.crew_id')::uuid);
    raise exception 'FAIL: zakladatel odešel z crew';
  exception when raise_exception then
    if sqlerrm <> 'founder_cannot_leave' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.notifications where type = 'crew_member_approved') then
    raise exception 'FAIL: člen nedostal upozornění o přijetí';
  end if;
  if (select my_status from public.crew_stats(current_setting('rls.crew_id')::uuid)) <> 'active' then
    raise exception 'FAIL: člen není aktivní';
  end if;
  if (select pending from public.crew_stats(current_setting('rls.crew_id')::uuid)) <> 0 then
    raise exception 'FAIL: běžný člen vidí počet žádostí';
  end if;
  perform public.leave_crew(current_setting('rls.crew_id')::uuid);
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if not exists (select 1 from public.leaderboard_crews('size', 'all', 100) where name = 'Audi RS6 Fans Praha' and members = 1) then
    raise exception 'FAIL: crew chybí v žebříčku';
  end if;
  if not exists (select 1 from public.profile_crews('00000000-0000-4000-a000-0000000ca201') where is_home) then
    raise exception 'FAIL: crew chybí na profilu zakladatele';
  end if;
end $$;
reset role;

-- =====================================================================
-- Milník 5d (část 2): crew jako pořadatel, sraz jen pro členy
-- Carol = zakladatelka crew, Bob = (zatím) nečlen, Alice = admin
-- =====================================================================
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform public.request_crew_organizer(current_setting('rls.crew_id')::uuid);
    raise exception 'FAIL: nečlen požádal za crew o pořádání';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000ca201","role":"authenticated"}', true);
set local role authenticated;
select public.request_crew_organizer(current_setting('rls.crew_id')::uuid);
reset role;

do $$ begin
  if not exists (select 1 from public.notifications
                 where user_id = '00000000-0000-4000-a000-00000000a11c' and type = 'crew_organizer_request') then
    raise exception 'FAIL: admin nedostal žádost crew o pořádání';
  end if;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
select public.admin_set_crew_organizer(current_setting('rls.crew_id')::uuid, true);
do $$ begin
  -- osobní pořadatel (Alice Events) nesmí mít sraz jen pro členy crew
  begin
    insert into public.events (organizer_id, slug, title, starts_at, ends_at, access)
    values ('00000000-0000-4000-c000-00000000000a', 'rls-spatne-crew', 'Špatně', now() + interval '9 days', now() + interval '10 days', 'crew_only');
    raise exception 'FAIL: osobní pořadatel vytvořil sraz jen pro členy crew';
  exception when raise_exception then
    if sqlerrm <> 'crew_only_requires_crew' then raise; end if;
  end;
end $$;
reset role;

-- Bob vstoupí do crew (Carol schválí)
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
select public.join_crew(current_setting('rls.crew_id')::uuid);
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000ca201","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_org uuid;
begin
  perform public.decide_crew_member(current_setting('rls.crew_id')::uuid, '00000000-0000-4000-a000-000000000b0b', 'approve');
  select id into v_org from public.my_organizers() where crew_id = current_setting('rls.crew_id')::uuid;
  if v_org is null then
    raise exception 'FAIL: zakladatel nespravuje pořadatele své crew';
  end if;
  perform set_config('rls.crew_org', v_org::text, true);
  -- Carol založí a zveřejní sraz jen pro členy (přes běžná pravidla pořadatele)
  insert into public.events (id, organizer_id, slug, title, starts_at, ends_at, status, access, registration_opens_at)
  values ('00000000-0000-4000-e000-000000000060', v_org, 'rls-crew-sraz', 'Crew sraz',
          now() + interval '20 days', now() + interval '21 days', 'published', 'crew_only', now() - interval '1 day');
  update public.organizers set description = 'Pořádáme srazy crew' where id = v_org;
  if (select description from public.organizers where id = v_org) <> 'Pořádáme srazy crew' then
    raise exception 'FAIL: správce crew nemůže upravit profil pořadatele';
  end if;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.events where id = '00000000-0000-4000-e000-000000000060') then
    raise exception 'FAIL: člen crew nevidí sraz jen pro členy';
  end if;
  if not exists (select 1 from public.notifications
                 where type = 'organizer_event_published' and event_id = '00000000-0000-4000-e000-000000000060') then
    raise exception 'FAIL: člen crew nedostal upozornění na sraz';
  end if;
  perform public.leave_crew(current_setting('rls.crew_id')::uuid);
  if exists (select 1 from public.events where id = '00000000-0000-4000-e000-000000000060') then
    raise exception 'FAIL: bývalý člen vidí sraz jen pro členy';
  end if;
  begin
    perform public.register_for_event('00000000-0000-4000-e000-000000000060', '00000000-0000-4000-b000-0000000000b1',
      '+420123456789', 'bob@example.invalid', null, true, true);
    raise exception 'FAIL: nečlen se přihlásil na sraz jen pro členy';
  exception when raise_exception then
    if sqlerrm <> 'crew_only' then raise; end if;
  end;
  update public.organizers set description = 'hack' where id = current_setting('rls.crew_org')::uuid;
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if exists (select 1 from public.events where id = '00000000-0000-4000-e000-000000000060') then
    raise exception 'FAIL: návštěvník vidí sraz jen pro členy';
  end if;
  if (select description from public.organizers where id = current_setting('rls.crew_org')::uuid) <> 'Pořádáme srazy crew' then
    raise exception 'FAIL: nečlen upravil profil pořadatele crew';
  end if;
end $$;
reset role;

-- =====================================================================
-- Spolupořadatelé a správci crew
-- Alice vlastní „Alice Events“, Carol = zakladatelka crew, Bob = člen
-- =====================================================================
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform public.add_organizer_member('00000000-0000-4000-c000-00000000000a', 'rls_bob');
    raise exception 'FAIL: cizí člověk přidal spolupořadatele';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
select public.add_organizer_member('00000000-0000-4000-c000-00000000000a', 'rls_bob');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.my_organizers() where id = '00000000-0000-4000-c000-00000000000a') then
    raise exception 'FAIL: spolupořadatel nespravuje pořadatele';
  end if;
  if not exists (select 1 from public.notifications where type = 'organizer_member_added') then
    raise exception 'FAIL: spolupořadatel nedostal upozornění';
  end if;
  insert into public.events (organizer_id, slug, title, starts_at, ends_at)
  values ('00000000-0000-4000-c000-00000000000a', 'rls-spolu', 'Od spolupořadatele', now() + interval '9 days', now() + interval '10 days');
  begin
    perform public.add_organizer_member('00000000-0000-4000-c000-00000000000a', 'rls_carol');
    raise exception 'FAIL: spolupořadatel přidal dalšího člověka';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
  begin
    insert into public.organizer_members (organizer_id, user_id) values ('00000000-0000-4000-c000-00000000000a', '00000000-0000-4000-a000-0000000ca201');
    raise exception 'FAIL: spolupořadatele jde zapsat přímo';
  exception when insufficient_privilege then null;
  end;
  perform public.remove_organizer_member('00000000-0000-4000-c000-00000000000a', auth.uid());
  if exists (select 1 from public.my_organizers() where id = '00000000-0000-4000-c000-00000000000a') then
    raise exception 'FAIL: spolupořadatel neodešel';
  end if;
end $$;
reset role;

-- Bob znovu do crew a Carol z něj udělá správce
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
select public.join_crew(current_setting('rls.crew_id')::uuid);
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000ca201","role":"authenticated"}', true);
set local role authenticated;
select public.decide_crew_member(current_setting('rls.crew_id')::uuid, '00000000-0000-4000-a000-000000000b0b', 'approve');
select public.set_crew_member_role(current_setting('rls.crew_id')::uuid, '00000000-0000-4000-a000-000000000b0b', 'admin');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.my_organizers() where crew_id = current_setting('rls.crew_id')::uuid) then
    raise exception 'FAIL: správce crew nespravuje její srazy';
  end if;
  if not exists (select 1 from public.notifications where type = 'crew_admin_added') then
    raise exception 'FAIL: správce crew nedostal upozornění';
  end if;
  begin
    perform public.set_crew_member_role(current_setting('rls.crew_id')::uuid, auth.uid(), 'member');
    raise exception 'FAIL: správce crew měnil role (smí jen zakladatel)';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
reset role;

-- =====================================================================
-- Úložiště: logo/úvodní fotka crew a logo pořadatele (oprava „name“)
-- =====================================================================
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000ca201","role":"authenticated"}', true);
set local role authenticated;
insert into storage.objects (bucket_id, name)
values ('crew-images', current_setting('rls.crew_id') || '/k-sm.webp');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
insert into storage.objects (bucket_id, name)
values ('organizer-logos', '00000000-0000-4000-c000-00000000000a/k-sm.webp');
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if not exists (select 1 from storage.objects where bucket_id = 'crew-images') then
    raise exception 'FAIL: obrázek schválené crew není vidět';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'organizer-logos') then
    raise exception 'FAIL: logo pořadatele není vidět';
  end if;
end $$;
reset role;

-- =====================================================================
-- Smazání pořadatele (jen vlastník/admin a jen bez eventů)
-- =====================================================================
-- Bob má z dřívějška vlastního pořadatele (c…0b) bez eventů
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform public.delete_organizer('00000000-0000-4000-c000-00000000000a');
    raise exception 'FAIL: cizí uživatel smazal pořadatele';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
  perform public.delete_organizer('00000000-0000-4000-c000-00000000000b');
end $$;
reset role;

do $$ begin
  if exists (select 1 from public.organizers where id = '00000000-0000-4000-c000-00000000000b') then
    raise exception 'FAIL: vlastník nesmazal svého pořadatele bez eventů';
  end if;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform public.delete_organizer('00000000-0000-4000-c000-00000000000a');
    raise exception 'FAIL: smazal se pořadatel, který má eventy';
  exception when raise_exception then
    if sqlerrm <> 'has_events' then raise; end if;
  end;
end $$;
reset role;

-- =====================================================================
-- CREATOR: portfolio, cover, úložiště profile-media
-- =====================================================================
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  -- bez přepnutí na Creator nic přidat nejde
  begin
    insert into public.portfolio_items (kind, photo_key, photo_format)
    values ('photo', gen_random_uuid(), 'webp');
    raise exception 'FAIL: portfolio bez typu Creator';
  exception when insufficient_privilege then null;
  end;
  update public.profiles set is_creator = true, creator_skills = array['photo', 'video'],
    cover_key = gen_random_uuid(), cover_format = 'webp'
  where id = auth.uid();
  insert into public.portfolio_items (kind, photo_key, photo_format, pinned)
  select 'photo', gen_random_uuid(), 'webp', true from generate_series(1, 12);
  insert into public.portfolio_items (kind, video_url, video_provider)
  values ('video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube');
  begin
    insert into public.portfolio_items (kind, photo_key, photo_format, pinned)
    values ('photo', gen_random_uuid(), 'webp', true);
    raise exception 'FAIL: připíchnuto víc než 12 prací';
  exception when raise_exception then
    if sqlerrm <> 'pin_limit' then raise; end if;
  end;
  begin
    update public.portfolio_items set video_url = 'https://evil.example/x' where kind = 'video';
    raise exception 'FAIL: odkaz videa jde přepsat';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set creator_skills = array['hacker'] where id = auth.uid();
    raise exception 'FAIL: neplatné zaměření creatora';
  exception when check_violation then null;
  end;
  begin
    insert into storage.objects (bucket_id, name)
    values ('profile-media', '00000000-0000-4000-a000-00000000a11c/cover/x-sm.webp');
    raise exception 'FAIL: nahrání do cizí složky profile-media';
  exception when insufficient_privilege then null;
  end;
end $$;
insert into storage.objects (bucket_id, name)
values ('profile-media', '00000000-0000-4000-a000-000000000b0b/cover/k-sm.webp');
reset role;

-- Cizí uživatel portfolio nezmění ani nesmaže
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000ca201","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  update public.portfolio_items set caption = 'hack' where owner_id = '00000000-0000-4000-a000-000000000b0b';
  delete from public.portfolio_items where owner_id = '00000000-0000-4000-a000-000000000b0b';
end $$;
reset role;

do $$ begin
  if (select count(*) from public.portfolio_items
      where owner_id = '00000000-0000-4000-a000-000000000b0b' and caption is null) <> 13 then
    raise exception 'FAIL: cizí uživatel změnil/smazal portfolio';
  end if;
end $$;

-- Návštěvník vidí portfolio i soubory veřejného profilu, soukromého ne
update public.profiles set visibility = 'public' where id = '00000000-0000-4000-a000-000000000b0b';
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if (select count(*) from public.portfolio_items where owner_id = '00000000-0000-4000-a000-000000000b0b') <> 13 then
    raise exception 'FAIL: návštěvník nevidí portfolio veřejného profilu';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'profile-media'
                 and name like '00000000-0000-4000-a000-000000000b0b/%') then
    raise exception 'FAIL: návštěvník nevidí cover veřejného profilu';
  end if;
end $$;
reset role;

update public.profiles set visibility = 'private' where id = '00000000-0000-4000-a000-000000000b0b';
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if exists (select 1 from public.portfolio_items where owner_id = '00000000-0000-4000-a000-000000000b0b') then
    raise exception 'FAIL: portfolio soukromého profilu je vidět';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'profile-media'
             and name like '00000000-0000-4000-a000-000000000b0b/%') then
    raise exception 'FAIL: cover soukromého profilu je vidět';
  end if;
end $$;
reset role;
update public.profiles set visibility = 'public' where id = '00000000-0000-4000-a000-000000000b0b';

-- =====================================================================
-- CREATOR část 2: média na eventu
-- =====================================================================
insert into public.events
  (id, organizer_id, slug, title, starts_at, ends_at, status, access, media_enabled, media_capacity)
values
  ('00000000-0000-4000-e000-000000000070', '00000000-0000-4000-c000-00000000000a',
   'rls-media', 'Média', now() + interval '20 days', now() + interval '21 days', 'published', 'public', true, 1),
  ('00000000-0000-4000-e000-000000000071', '00000000-0000-4000-c000-00000000000a',
   'rls-bez-medii', 'Bez médií', now() + interval '20 days', now() + interval '21 days', 'published', 'public', false, null);
update public.profiles set is_creator = true, username = coalesce(username, 'rls_carol')
where id = '00000000-0000-4000-a000-0000000ca201';

-- Bob (Creator) se hlásí jako média
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.request_media('00000000-0000-4000-e000-000000000070', '+420777111222', 'bob@example.invalid', 'Pro magazín', array['photo', 'hacker'], true);
  if (select skills from public.event_media_requests where user_id = auth.uid()) <> array['photo'] then
    raise exception 'FAIL: neplatné zaměření prošlo do žádosti';
  end if;
  begin
    perform public.request_media('00000000-0000-4000-e000-000000000070', '+420777111222', 'bob@example.invalid', null, null, true);
    raise exception 'FAIL: dvojí žádost médií';
  exception when raise_exception then
    if sqlerrm <> 'already_registered' then raise; end if;
  end;
  begin
    perform public.request_media('00000000-0000-4000-e000-000000000071', '+420777111222', 'bob@example.invalid', null, null, true);
    raise exception 'FAIL: žádost na event bez médií';
  exception when raise_exception then
    if sqlerrm <> 'media_disabled' then raise; end if;
  end;
  begin
    insert into public.event_media_requests (event_id, user_id, contact_phone, contact_email)
    values ('00000000-0000-4000-e000-000000000070', auth.uid(), '12345', 'a@b.c');
    raise exception 'FAIL: žádost médií jde zapsat přímo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.decide_media_request((select id from public.event_media_requests where user_id = auth.uid()), 'approved');
    raise exception 'FAIL: žadatel si sám schválil akreditaci';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
reset role;

-- Návštěvník zatím nikoho nevidí (čeká na schválení)
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if exists (select 1 from public.event_media_list('00000000-0000-4000-e000-000000000070')) then
    raise exception 'FAIL: neschválená média jsou veřejně vidět';
  end if;
end $$;
reset role;

-- Carol (Creator) se hlásí taky
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000ca201","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.request_media('00000000-0000-4000-e000-000000000070', '+420777333444', 'carol@example.invalid', null, array['video'], true);
end $$;
reset role;

-- Pořadatel (Alice) schválí Boba; na Carol už limit nestačí
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.event_media_requests
      where event_id = '00000000-0000-4000-e000-000000000070') <> 2 then
    raise exception 'FAIL: pořadatel nevidí žádosti médií';
  end if;
  perform public.decide_media_request(
    (select id from public.event_media_requests where user_id = '00000000-0000-4000-a000-000000000b0b'
       and event_id = '00000000-0000-4000-e000-000000000070'), 'approved', 'Vítej!');
  begin
    perform public.decide_media_request(
      (select id from public.event_media_requests where user_id = '00000000-0000-4000-a000-0000000ca201'
         and event_id = '00000000-0000-4000-e000-000000000070'), 'approved');
    raise exception 'FAIL: překročen limit míst pro média';
  exception when raise_exception then
    if sqlerrm <> 'media_full' then raise; end if;
  end;
end $$;
reset role;

do $$ begin
  if not exists (select 1 from public.notifications
                 where user_id = '00000000-0000-4000-a000-000000000b0b' and type = 'media_approved') then
    raise exception 'FAIL: schválená média nedostala upozornění';
  end if;
end $$;

-- Veřejný profil Boba je teď vidět v seznamu médií (bez kontaktů)
update public.profiles set visibility = 'public' where id = '00000000-0000-4000-a000-000000000b0b';
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if (select count(*) from public.event_media_list('00000000-0000-4000-e000-000000000070')) <> 1 then
    raise exception 'FAIL: schválená média nejsou vidět na eventu';
  end if;
  begin
    perform 1 from public.event_media_requests;
    raise exception 'FAIL: návštěvník čte žádosti médií (kontakty)';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Bob cizí žádost (Carol) nevidí; akreditaci zruší → zmizí ze seznamu
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.event_media_requests
      where event_id = '00000000-0000-4000-e000-000000000070') <> 1 then
    raise exception 'FAIL: žadatel vidí cizí žádost médií';
  end if;
end $$;
select public.cancel_media_request(
  (select id from public.event_media_requests where user_id = auth.uid()
     and event_id = '00000000-0000-4000-e000-000000000070'));
reset role;
do $$ begin
  if exists (select 1 from public.event_media_list('00000000-0000-4000-e000-000000000070')) then
    raise exception 'FAIL: zrušená média jsou dál vidět';
  end if;
end $$;

-- =====================================================================
-- Povinný souhlas s propagací (registrace + jednorázové potvrzení)
-- =====================================================================
insert into auth.users (id, email, aud, role, instance_id, raw_user_meta_data)
values ('00000000-0000-4000-a000-0000000d0e01', 'rls-test-promo@example.invalid', 'authenticated', 'authenticated',
        '00000000-0000-0000-0000-000000000000', '{"locale":"cs","promo_consent_version":"2026-11-13"}');
do $$ begin
  if not exists (select 1 from public.profiles where id = '00000000-0000-4000-a000-0000000d0e01'
                 and promo_consent_at is not null and promo_consent_version = '2026-11-13') then
    raise exception 'FAIL: souhlas z registrace se neuložil';
  end if;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    update public.profiles set promo_consent_at = now() where id = auth.uid();
    raise exception 'FAIL: souhlas jde zapsat přímo';
  exception when insufficient_privilege then null;
  end;
  perform public.accept_promo_consent('2026-11-13');
  if not exists (select 1 from public.profiles where id = auth.uid() and promo_consent_version = '2026-11-13') then
    raise exception 'FAIL: potvrzení souhlasu se neuložilo';
  end if;
end $$;
reset role;

-- =====================================================================
-- Spolupořádání eventu (hlavní Alice c…0a, spolupořadatel = crew-pořadatel)
-- =====================================================================
select set_config('rls.cohost_slug',
  (select slug from public.organizers where id = current_setting('rls.crew_org')::uuid), true);

-- Bob (správce crew) žádá o spolupořádání eventu Alice
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if public.request_event_cohost('00000000-0000-4000-e000-000000000070', current_setting('rls.crew_org')::uuid) <> 'pending' then
    raise exception 'FAIL: žádost o spolupořádání nečeká na potvrzení';
  end if;
  begin
    perform public.decide_event_cohost('00000000-0000-4000-e000-000000000070', current_setting('rls.crew_org')::uuid, true);
    raise exception 'FAIL: žadatel si sám potvrdil spolupořádání';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
  begin
    insert into public.event_cohosts (event_id, organizer_id, status, invited_by_host)
    values ('00000000-0000-4000-e000-000000000070', current_setting('rls.crew_org')::uuid, 'accepted', false);
    raise exception 'FAIL: spolupořádání jde zapsat přímo';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Cizí člověk žádat za cizího pořadatele nemůže
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000d0e01","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform public.request_event_cohost('00000000-0000-4000-e000-000000000070', current_setting('rls.crew_org')::uuid);
    raise exception 'FAIL: cizí uživatel žádal za cizího pořadatele';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
reset role;

-- Nepotvrzené spolupořádání návštěvník nevidí
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if exists (select 1 from public.event_cohosts where event_id = '00000000-0000-4000-e000-000000000070') then
    raise exception 'FAIL: nepotvrzené spolupořádání je veřejně vidět';
  end if;
end $$;
reset role;

-- Alice (hlavní pořadatel) potvrdí
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
select public.decide_event_cohost('00000000-0000-4000-e000-000000000070', current_setting('rls.crew_org')::uuid, true);
do $$ begin
  begin
    perform public.invite_event_cohost('00000000-0000-4000-e000-000000000070', current_setting('rls.cohost_slug'));
    raise exception 'FAIL: dvojí spolupořádání';
  exception when raise_exception then
    if sqlerrm <> 'already_cohost' then raise; end if;
  end;
end $$;
reset role;

do $$ begin
  if not exists (select 1 from public.notifications where type = 'cohost_request'
                 and user_id = '00000000-0000-4000-a000-00000000a11c') then
    raise exception 'FAIL: hlavní pořadatel nedostal žádost o spolupořádání';
  end if;
  if not exists (select 1 from public.notifications where type = 'cohost_accepted'
                 and user_id = '00000000-0000-4000-a000-000000000b0b') then
    raise exception 'FAIL: spolupořadatel nedostal potvrzení';
  end if;
end $$;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if (select count(*) from public.event_cohosts
      where event_id = '00000000-0000-4000-e000-000000000070' and status = 'accepted') <> 1 then
    raise exception 'FAIL: potvrzené spolupořádání není vidět';
  end if;
end $$;
reset role;

-- Bob spolupořádání ukončí; Alice pak pozve a Bobova „žádost“ pozvánku přijme
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
select public.remove_event_cohost('00000000-0000-4000-e000-000000000070', current_setting('rls.crew_org')::uuid);
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if public.invite_event_cohost('00000000-0000-4000-e000-000000000070', current_setting('rls.cohost_slug')) <> 'pending' then
    raise exception 'FAIL: pozvánka nečeká na potvrzení';
  end if;
  begin
    perform public.decide_event_cohost('00000000-0000-4000-e000-000000000070', current_setting('rls.crew_org')::uuid, true);
    raise exception 'FAIL: hlavní pořadatel potvrdil vlastní pozvánku';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if public.request_event_cohost('00000000-0000-4000-e000-000000000070', current_setting('rls.crew_org')::uuid) <> 'accepted' then
    raise exception 'FAIL: žádost nepřijala čekající pozvánku';
  end if;
end $$;
reset role;

-- =====================================================================
-- Galerie eventu a označení aut / eventů u prací v portfoliu
-- =====================================================================
insert into public.vehicles (id, owner_id, category, make, model, visibility)
values ('00000000-0000-4000-b000-0000000000f1', '00000000-0000-4000-a000-000000000b0b', 'tuning', 'BMW', 'E30', 'public');
update public.profiles set visibility = 'public' where id = '00000000-0000-4000-a000-000000000b0b';

-- Carol (Creator) zatím akreditaci nemá → eventem označit nejde
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000ca201","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    insert into public.portfolio_items (kind, photo_key, photo_format, event_id)
    values ('photo', gen_random_uuid(), 'webp', '00000000-0000-4000-e000-000000000071');
    raise exception 'FAIL: práce označená eventem bez akreditace';
  exception when raise_exception then
    if sqlerrm <> 'not_event_media' then raise; end if;
  end;
end $$;
reset role;

-- Alice schválí Carol jako média
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
select public.decide_media_request(
  (select id from public.event_media_requests where user_id = '00000000-0000-4000-a000-0000000ca201'
     and event_id = '00000000-0000-4000-e000-000000000070'), 'approved');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000ca201","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  insert into public.portfolio_items (id, kind, photo_key, photo_format, event_id, vehicle_id)
  values ('00000000-0000-4000-f000-0000000000a1', 'photo', gen_random_uuid(), 'webp',
          '00000000-0000-4000-e000-000000000070', '00000000-0000-4000-b000-0000000000f1');
  begin
    update public.portfolio_items set vehicle_id = '00000000-0000-4000-b000-00000000000b'
    where id = '00000000-0000-4000-f000-0000000000a1';
    raise exception 'FAIL: označeno soukromé auto';
  exception when raise_exception then
    if sqlerrm <> 'vehicle_unavailable' then raise; end if;
  end;
  begin
    update public.portfolio_items set hidden_in_event = true where id = '00000000-0000-4000-f000-0000000000a1';
    raise exception 'FAIL: creator skryl práci v galerii sám (smí jen pořadatel)';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$ begin
  if not exists (select 1 from public.notifications
                 where user_id = '00000000-0000-4000-a000-000000000b0b' and type = 'vehicle_tagged') then
    raise exception 'FAIL: majitel auta nedostal upozornění na označení';
  end if;
end $$;

-- Návštěvník vidí práci v galerii i u auta
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if (select count(*) from public.event_media_works('00000000-0000-4000-e000-000000000070')) <> 1 then
    raise exception 'FAIL: práce médií není v galerii eventu';
  end if;
  if (select count(*) from public.vehicle_creator_works('00000000-0000-4000-b000-0000000000f1')) <> 1 then
    raise exception 'FAIL: fotka od creatora není u auta';
  end if;
end $$;
reset role;

-- Pořadatel (Alice) práci skryje a nahraje vlastní fotku; Bob do galerie cizího eventu nesmí
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
select public.set_event_photo_hidden('00000000-0000-4000-f000-0000000000a1', true);
insert into public.event_photos (event_id, photo_key, photo_format)
values ('00000000-0000-4000-e000-000000000070', gen_random_uuid(), 'webp');
insert into storage.objects (bucket_id, name)
values ('event-gallery', '00000000-0000-4000-e000-000000000070/x/k-sm.webp');
do $$ begin
  if not (select hidden from public.event_media_works('00000000-0000-4000-e000-000000000070') limit 1) then
    raise exception 'FAIL: pořadatel nevidí skrytou práci';
  end if;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    insert into public.event_photos (event_id, photo_key, photo_format)
    values ('00000000-0000-4000-e000-000000000070', gen_random_uuid(), 'webp');
    raise exception 'FAIL: cizí uživatel nahrál fotku do galerie eventu';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name)
    values ('event-gallery', '00000000-0000-4000-e000-000000000070/y/k-sm.webp');
    raise exception 'FAIL: cizí uživatel nahrál soubor do galerie eventu';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_event_photo_hidden('00000000-0000-4000-f000-0000000000a1', false);
    raise exception 'FAIL: cizí uživatel změnil skrytí v galerii';
  exception when raise_exception then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
  -- majitel auta označení odebere
  perform public.untag_vehicle_photo('00000000-0000-4000-f000-0000000000a1');
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if exists (select 1 from public.event_media_works('00000000-0000-4000-e000-000000000070')) then
    raise exception 'FAIL: skrytá práce je v galerii vidět';
  end if;
  if exists (select 1 from public.vehicle_creator_works('00000000-0000-4000-b000-0000000000f1')) then
    raise exception 'FAIL: odebrané označení je dál u auta';
  end if;
  if (select count(*) from public.event_photos where event_id = '00000000-0000-4000-e000-000000000070') <> 1 then
    raise exception 'FAIL: fotka pořadatele není v galerii vidět';
  end if;
end $$;
reset role;

-- =====================================================================
-- Turba na pracích v portfoliu (Bob = Creator s veřejným profilem)
-- =====================================================================
select set_config('rls.work_id',
  (select id::text from public.portfolio_items where owner_id = '00000000-0000-4000-a000-000000000b0b' limit 1), true);
update public.profiles set visibility = 'public' where id = '00000000-0000-4000-a000-000000000b0b';

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r record;
begin
  select * into r from public.toggle_turbo(p_portfolio_item_id => current_setting('rls.work_id')::uuid);
  if not r.given or r.total <> 1 then raise exception 'FAIL: turbo práci v portfoliu se nedalo'; end if;
  begin
    perform public.toggle_turbo(p_photo_id => gen_random_uuid(), p_portfolio_item_id => current_setting('rls.work_id')::uuid);
    raise exception 'FAIL: turbo na dva cíle najednou';
  exception when raise_exception then
    if sqlerrm <> 'invalid_target' then raise; end if;
  end;
end $$;
reset role;

do $$ begin
  if not exists (select 1 from public.notifications
                 where user_id = '00000000-0000-4000-a000-000000000b0b' and type = 'turbo_received'
                   and payload ->> 'target' = 'portfolio') then
    raise exception 'FAIL: creator nedostal upozornění na turbo práce';
  end if;
end $$;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if (select turbos from public.portfolio_turbo_stats(array[current_setting('rls.work_id')::uuid])) <> 1 then
    raise exception 'FAIL: počet turb práce nesedí';
  end if;
end $$;
reset role;

-- Vlastní práci turbo nedá; soukromý profil turbo nedostane
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000b0b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform public.toggle_turbo(p_portfolio_item_id => current_setting('rls.work_id')::uuid);
    raise exception 'FAIL: turbo vlastní práci';
  exception when raise_exception then
    if sqlerrm <> 'own_content' then raise; end if;
  end;
end $$;
reset role;

update public.profiles set visibility = 'private' where id = '00000000-0000-4000-a000-000000000b0b';
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r record;
begin
  begin
    perform public.toggle_turbo(p_portfolio_item_id => current_setting('rls.work_id')::uuid);
    raise exception 'FAIL: turbo práci soukromého profilu';
  exception when raise_exception then
    if sqlerrm <> 'not_found' then raise; end if;
  end;
end $$;
reset role;
update public.profiles set visibility = 'public' where id = '00000000-0000-4000-a000-000000000b0b';

-- Druhé klepnutí turbo odebere
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r record;
begin
  select * into r from public.toggle_turbo(p_portfolio_item_id => current_setting('rls.work_id')::uuid);
  if r.given or r.total <> 0 then raise exception 'FAIL: turbo práce nejde odebrat'; end if;
end $$;
reset role;

select 'OK: všechny testy pravidel přístupu prošly' as vysledek;

rollback;
