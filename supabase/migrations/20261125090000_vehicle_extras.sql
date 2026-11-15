-- =====================================================================
-- Připomínky testerů (3. kolo) – garáž
-- - Nové kategorie vozidel: Performance (sportovní / track toy), Drift
-- - Nová kategorie úprav: Výfuk
-- - „Na co jsem v tomhle projektu nejvíc hrdý“ (proud_of)
-- - Srdcovka (highlighted): zvýrazněné auto (hlavně mezi bývalými) –
--   na profilu barevně, první v pořadí, se štítkem
-- Vozidla mění majitel celým řádkem (politika „vehicles: update own“),
-- nové sloupce tedy nepotřebují zvláštní práva.
-- =====================================================================

alter type public.vehicle_category add value if not exists 'performance' after 'american';
alter type public.vehicle_category add value if not exists 'drift' after 'performance';

alter type public.mod_category add value if not exists 'exhaust' after 'drivetrain';

alter table public.vehicles
  add column proud_of text check (char_length(proud_of) <= 300),
  add column highlighted boolean not null default false;
