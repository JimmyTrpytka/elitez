-- =====================================================================
-- Připomínka testera (22. 11. 2026): po žádosti o akreditaci médií
-- nepřišlo žádné potvrzení a pořadatel se o žádosti nedozvěděl.
-- Nově: creator dostane potvrzení (v aplikaci i e-mailem),
-- správci pořadatele upozornění „nová žádost o akreditaci“.
-- =====================================================================

create function public.media_request_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_name text;
begin
  select * into v_event from public.events where id = new.event_id;
  select coalesce(display_name, '@' || username) into v_name from public.profiles where id = new.user_id;

  -- Potvrzení žadateli
  perform public.enqueue_user_message(
    new.user_id, 'media_request_received', new.event_id, null,
    jsonb_build_object(
      'event_title', v_event.title,
      'event_slug', v_event.slug,
      'event_starts_at', v_event.starts_at,
      'event_ends_at', v_event.ends_at,
      'event_timezone', v_event.timezone
    ),
    true
  );

  -- Upozornění správcům pořadatele (bez žadatele, pokud je sám správce)
  perform public.notify_organizer_managers(
    v_event.organizer_id, 'media_requested', v_event,
    jsonb_build_object(
      'event_title', v_event.title,
      'event_slug', v_event.slug,
      'event_id', v_event.id,
      'name', v_name
    )
  );
  return new;
end;
$$;

revoke execute on function public.media_request_notify() from public, anon, authenticated;

create trigger event_media_requests_notify
  after insert on public.event_media_requests
  for each row execute function public.media_request_notify();
