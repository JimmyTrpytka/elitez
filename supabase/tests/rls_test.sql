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

select 'OK: všechny testy pravidel přístupu prošly' as vysledek;

rollback;
