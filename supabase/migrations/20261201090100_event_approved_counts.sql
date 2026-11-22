-- =====================================================================
-- Audit UX (22. 11. 2026): štítky na kartách eventů („Poslední místa“,
-- „Plno · čekací listina“). Vrací jen POČET schválených přihlášek u eventů
-- s kapacitou, které čtenář smí vidět – žádná jména ani auta.
-- =====================================================================
create function public.event_approved_counts(p_event_ids uuid[])
returns table (event_id uuid, approved integer)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, (
    select count(*)::integer from public.event_registrations r
    where r.event_id = e.id and r.status = 'approved'
  )
  from public.events e
  where e.id = any (p_event_ids[1:200])
    and e.capacity is not null
    and public.event_is_visible(e.id);
$$;

revoke execute on function public.event_approved_counts(uuid[]) from public;
grant execute on function public.event_approved_counts(uuid[]) to anon, authenticated;
