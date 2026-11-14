-- =====================================================================
-- Odznak „Beta tester“ (legendární) pro všechny, kdo se přidají během
-- testování. Při spuštění ho admin vypne (badges.active = false) –
-- noví členové ho pak už nedostanou, kdo ho má, tomu zůstane.
-- =====================================================================

insert into public.badges
  (code, category, icon, rarity, is_unique, threshold, sort, name_cs, name_en, description_cs, description_en)
values
  ('beta_tester', 'community', 'beta', 'legendary', false, null, 49,
   'Beta tester', 'Beta tester',
   'Přidal(a) se do klubu během testování a pomohl(a) ho postavit. Po spuštění už ho nikdo nezíská.',
   'Joined the club during testing and helped build it. Nobody can get it after launch.')
on conflict (code) do nothing;

-- Nový člen během testování (odznak je aktivní)
create function public.award_beta_tester()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_badge(new.id, 'beta_tester');
  return new;
end;
$$;

create trigger profiles_beta_tester
  after insert on public.profiles
  for each row execute function public.award_beta_tester();

-- Stávající členové (s upozorněním – ať o odznaku vědí)
select public.award_badge(p.id, 'beta_tester') from public.profiles p;
