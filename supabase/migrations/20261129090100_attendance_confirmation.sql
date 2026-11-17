-- =====================================================================
-- Registrace na srazy – vylepšení, část 4 (SPEC 5.1k, bod L)
-- Potvrzení účasti: X dní před eventem dostanou schválení výzvu
-- „Potvrď, že přijedeš“. „Nepřijedu“ = zrušení přihlášky (uvolní místo,
-- posune čekací listinu). Kdo nepotvrdí, je označený – místo uvolní pořadatel.
-- =====================================================================

alter table public.events
  add column confirm_days_before smallint check (confirm_days_before between 1 and 30);

alter table public.event_registrations
  add column attendance_confirmed_at timestamptz,
  add column confirm_requested_at timestamptz;

-- Je u eventu otevřené okno pro potvrzení účasti?
create function public.attendance_window_open(p_event public.events)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_event.confirm_days_before is not null
    and now() >= p_event.starts_at - make_interval(days => p_event.confirm_days_before)
    and now() < p_event.starts_at;
$$;

-- Uchazeč potvrdí, že přijede (jen schválená přihláška v okně potvrzení)
create function public.confirm_attendance(p_registration_id uuid)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_registrations;
  v_event public.events;
begin
  select * into v_row from public.event_registrations where id = p_registration_id;
  if not found or v_row.user_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if v_row.status <> 'approved' then raise exception 'not_editable'; end if;
  select * into v_event from public.events where id = v_row.event_id;
  if not public.attendance_window_open(v_event) then raise exception 'confirm_not_open'; end if;

  update public.event_registrations
  set attendance_confirmed_at = coalesce(attendance_confirmed_at, now())
  where id = p_registration_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.confirm_attendance(uuid) from public, anon;
grant execute on function public.confirm_attendance(uuid) to authenticated;

-- Denně (cron): rozeslat výzvy všem schváleným, kterým se okno otevřelo
-- a výzvu ještě nedostali. Volá jen server tajným klíčem. Vrací počet výzev.
create function public.send_attendance_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_count integer := 0;
begin
  for v_item in
    select r.id, r.user_id, r.event_id, e.title, e.slug, e.starts_at, e.ends_at, e.timezone,
           v.make || ' ' || v.model as vehicle
    from public.event_registrations r
    join public.events e on e.id = r.event_id
    join public.vehicles v on v.id = r.vehicle_id
    where r.status = 'approved'
      and r.confirm_requested_at is null
      and r.attendance_confirmed_at is null
      and e.status = 'published'
      and public.attendance_window_open(e)
    for update of r skip locked
  loop
    update public.event_registrations set confirm_requested_at = now() where id = v_item.id;
    perform public.enqueue_user_message(
      v_item.user_id, 'attendance_confirm_request', v_item.event_id, v_item.id,
      jsonb_build_object(
        'event_title', v_item.title,
        'event_slug', v_item.slug,
        'event_starts_at', v_item.starts_at,
        'event_ends_at', v_item.ends_at,
        'event_timezone', v_item.timezone,
        'vehicle', v_item.vehicle
      ),
      true
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.send_attendance_requests() from public, anon, authenticated;
grant execute on function public.send_attendance_requests() to service_role;
