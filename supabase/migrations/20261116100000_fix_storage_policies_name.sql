-- =====================================================================
-- Oprava: v pravidlech úložiště se „name“ (cesta k souboru) zaměnilo
-- s ve sloupcem „name“ tabulek crews / organizers uvnitř poddotazu.
-- Výsledek: nešlo nahrát logo/úvodní fotku crew a nezobrazovala se loga
-- pořadatelů. Teď je vždy výslovně storage.objects.name.
-- =====================================================================

drop policy "crew-images: read if crew visible" on storage.objects;
create policy "crew-images: read if crew visible"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'crew-images'
    and exists (
      select 1 from public.crews c
      where c.id::text = (storage.foldername(objects.name))[1]
    )
  );

drop policy "crew-images: upload by managers" on storage.objects;
create policy "crew-images: upload by managers"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'crew-images'
    and exists (
      select 1 from public.crews c
      where c.id::text = (storage.foldername(objects.name))[1]
        and public.is_crew_manager(c.id)
    )
  );

drop policy "crew-images: delete by managers" on storage.objects;
create policy "crew-images: delete by managers"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'crew-images'
    and exists (
      select 1 from public.crews c
      where c.id::text = (storage.foldername(objects.name))[1]
        and public.is_crew_manager(c.id)
    )
  );

drop policy "organizer-logos: read if organizer visible" on storage.objects;
create policy "organizer-logos: read if organizer visible"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'organizer-logos'
    and exists (
      select 1 from public.organizers o
      where o.id::text = (storage.foldername(objects.name))[1]
    )
  );
