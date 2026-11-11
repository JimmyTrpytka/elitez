-- =====================================================================
-- Milník 5: upozornění v aplikaci, fronta e-mailů, hromadné zprávy
-- Pravidla viz SPEC.md 5.1d.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Jazyk e-mailů u profilu
-- ---------------------------------------------------------------------
alter table public.profiles
  add column locale text not null default 'cs' check (locale in ('cs', 'en'));

grant update (locale) on public.profiles to authenticated;

update public.profiles p
set locale = case when u.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'cs' end
from auth.users u
where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, locale)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'cs' end
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Upozornění v aplikaci (zvoneček)
-- ---------------------------------------------------------------------
create type public.notification_type as enum (
  'registration_received',
  'registration_approved',
  'registration_rejected',
  'registration_waitlist',
  'registration_promoted',
  'registration_cancelled',
  'broadcast'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  event_id uuid references public.events (id) on delete cascade,
  registration_id uuid references public.event_registrations (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications: read own"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Uživatel smí jen označit své upozornění jako přečtené
create policy "notifications: mark own read"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------
-- Fronta e-mailů (čte a odesílá jen server s tajným klíčem – žádné politiky)
-- ---------------------------------------------------------------------
create type public.email_status as enum ('queued', 'sending', 'sent', 'failed');

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  to_email text not null,
  locale text not null default 'cs',
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.email_status not null default 'queued',
  attempts integer not null default 0,
  last_error text,
  provider_id text,
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_outbox_queue_idx on public.email_outbox (status, send_after);
create index email_outbox_sent_idx on public.email_outbox (sent_at) where status = 'sent';

create trigger email_outbox_set_updated_at
  before update on public.email_outbox
  for each row execute function public.set_updated_at();

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

-- Vloží upozornění a e-mail do fronty (interní)
create function public.enqueue_user_message(
  p_user_id uuid,
  p_type public.notification_type,
  p_event_id uuid,
  p_registration_id uuid,
  p_payload jsonb,
  p_send_email boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_locale text;
  v_name text;
  v_payload jsonb;
begin
  select u.email, p.locale, coalesce(p.display_name, p.username)
  into v_email, v_locale, v_name
  from auth.users u join public.profiles p on p.id = u.id
  where u.id = p_user_id;

  v_payload := p_payload || jsonb_build_object('name', v_name);

  insert into public.notifications (user_id, type, event_id, registration_id, payload)
  values (p_user_id, p_type, p_event_id, p_registration_id, v_payload);

  if p_send_email and v_email is not null then
    insert into public.email_outbox (user_id, to_email, locale, template, payload)
    values (p_user_id, v_email, coalesce(v_locale, 'cs'), p_type::text, v_payload);
  end if;
end;
$$;

revoke execute on function public.enqueue_user_message(uuid, public.notification_type, uuid, uuid, jsonb, boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Automatické zprávy při změně stavu přihlášky
-- ---------------------------------------------------------------------
create function public.registration_status_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_vehicle text;
  v_type public.notification_type;
  v_email boolean := true;
  v_payload jsonb;
begin
  if tg_op = 'UPDATE' and new.status = old.status then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_type := case when new.status = 'waitlist' then 'registration_waitlist' else 'registration_received' end;
  elsif new.status = 'approved' then
    v_type := case when old.status = 'waitlist' and new.decided_by is null
                   then 'registration_promoted' else 'registration_approved' end;
  elsif new.status = 'rejected' then
    v_type := 'registration_rejected';
  elsif new.status = 'waitlist' then
    v_type := 'registration_waitlist';
  elsif new.status = 'cancelled' then
    v_type := 'registration_cancelled';
    v_email := false;
  else
    -- návrat k posouzení: bez zprávy
    return new;
  end if;

  select * into v_event from public.events where id = new.event_id;
  select make || ' ' || model into v_vehicle from public.vehicles where id = new.vehicle_id;

  v_payload := jsonb_build_object(
    'event_title', v_event.title,
    'event_slug', v_event.slug,
    'event_starts_at', v_event.starts_at,
    'event_ends_at', v_event.ends_at,
    'event_timezone', v_event.timezone,
    'vehicle', v_vehicle,
    'reason', new.rejection_reason,
    'message', new.decision_message
  );

  perform public.enqueue_user_message(
    new.user_id, v_type, new.event_id, new.id, v_payload, v_email
  );
  return new;
end;
$$;

create trigger event_registrations_notify
  after insert or update of status on public.event_registrations
  for each row execute function public.registration_status_notify();

-- ---------------------------------------------------------------------
-- Hromadné zprávy pořadatele
-- ---------------------------------------------------------------------
create type public.broadcast_segment as enum (
  'approved', 'pending', 'waitlist', 'approved_verified', 'all_active'
);

create table public.message_broadcasts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  segment public.broadcast_segment not null,
  subject text not null check (char_length(subject) between 1 and 150),
  body text not null check (char_length(body) between 1 and 5000),
  recipient_count integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index message_broadcasts_event_idx on public.message_broadcasts (event_id, created_at desc);

alter table public.message_broadcasts enable row level security;

create policy "broadcasts: organizer reads own events"
  on public.message_broadcasts for select
  to authenticated
  using (public.is_event_organizer(event_id));

revoke insert, update, delete on public.message_broadcasts from anon, authenticated;

-- Příjemci podle skupiny (jeden člověk = jedna zpráva, i s více auty)
create function public.broadcast_recipients(p_event_id uuid, p_segment public.broadcast_segment)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct r.user_id
  from public.event_registrations r
  join public.profiles p on p.id = r.user_id
  where r.event_id = p_event_id
    and case p_segment
      when 'approved' then r.status = 'approved'
      when 'pending' then r.status = 'pending'
      when 'waitlist' then r.status = 'waitlist'
      when 'approved_verified' then r.status = 'approved' and p.verified_at is not null
      else r.status in ('pending', 'approved', 'waitlist')
    end;
$$;

revoke execute on function public.broadcast_recipients(uuid, public.broadcast_segment) from public, anon, authenticated;

-- Počet příjemců pro náhled (jen pořadatel eventu)
create function public.broadcast_recipient_count(p_event_id uuid, p_segment public.broadcast_segment)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_event_organizer(p_event_id) then raise exception 'not_allowed'; end if;
  return (select count(*) from public.broadcast_recipients(p_event_id, p_segment));
end;
$$;

-- Odeslání hromadné zprávy: uloží historii, upozornění a e-maily do fronty
create function public.send_broadcast(
  p_event_id uuid,
  p_segment public.broadcast_segment,
  p_subject text,
  p_body text
)
returns public.message_broadcasts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_row public.message_broadcasts;
  v_user uuid;
  v_count integer := 0;
begin
  if not public.is_event_organizer(p_event_id) then raise exception 'not_allowed'; end if;
  if char_length(trim(coalesce(p_subject, ''))) not between 1 and 150
     or char_length(trim(coalesce(p_body, ''))) not between 1 and 5000 then
    raise exception 'invalid_message';
  end if;
  if (
    select count(*) from public.message_broadcasts
    where event_id = p_event_id and created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'daily_limit';
  end if;

  select * into v_event from public.events where id = p_event_id;

  insert into public.message_broadcasts (event_id, segment, subject, body, created_by)
  values (p_event_id, p_segment, trim(p_subject), trim(p_body), auth.uid())
  returning * into v_row;

  for v_user in select user_id from public.broadcast_recipients(p_event_id, p_segment) loop
    perform public.enqueue_user_message(
      v_user, 'broadcast', p_event_id, null,
      jsonb_build_object(
        'broadcast_id', v_row.id,
        'subject', v_row.subject,
        'body', v_row.body,
        'event_title', v_event.title,
        'event_slug', v_event.slug,
        'event_starts_at', v_event.starts_at,
        'event_ends_at', v_event.ends_at,
        'event_timezone', v_event.timezone
      ),
      true
    );
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then raise exception 'no_recipients'; end if;

  update public.message_broadcasts set recipient_count = v_count where id = v_row.id
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.broadcast_recipient_count(uuid, public.broadcast_segment) from public, anon;
revoke execute on function public.send_broadcast(uuid, public.broadcast_segment, text, text) from public, anon;
grant execute on function public.broadcast_recipient_count(uuid, public.broadcast_segment) to authenticated;
grant execute on function public.send_broadcast(uuid, public.broadcast_segment, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Odesílání fronty (volá jen server s tajným klíčem = role service_role)
-- ---------------------------------------------------------------------

-- Vezme dávku e-mailů k odeslání (s ohledem na denní limit poskytovatele)
create function public.claim_email_batch(p_limit integer, p_daily_limit integer)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sent_today integer;
  v_take integer;
begin
  select count(*) into v_sent_today
  from public.email_outbox
  where status in ('sent', 'sending') and coalesce(sent_at, updated_at) >= date_trunc('day', now());

  v_take := least(p_limit, greatest(p_daily_limit - v_sent_today, 0));
  if v_take <= 0 then return; end if;

  return query
  update public.email_outbox o
  set status = 'sending', attempts = o.attempts + 1
  where o.id in (
    select id from public.email_outbox
    where (status = 'queued' and send_after <= now())
       or (status = 'sending' and updated_at < now() - interval '10 minutes')
    order by created_at
    limit v_take
    for update skip locked
  )
  returning o.*;
end;
$$;

create function public.complete_email(p_id uuid, p_provider_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.email_outbox
  set status = 'sent', sent_at = now(), provider_id = p_provider_id, last_error = null
  where id = p_id;
$$;

-- Chyba: zkusit znovu později (5 pokusů), pak „failed“
create function public.fail_email(p_id uuid, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.email_outbox
  set status = case when attempts >= 5 then 'failed'::public.email_status else 'queued'::public.email_status end,
      last_error = left(p_error, 500),
      send_after = now() + make_interval(mins => 5 * attempts)
  where id = p_id;
$$;

revoke execute on function public.claim_email_batch(integer, integer) from public, anon, authenticated;
revoke execute on function public.complete_email(uuid, text) from public, anon, authenticated;
revoke execute on function public.fail_email(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_email_batch(integer, integer) to service_role;
grant execute on function public.complete_email(uuid, text) to service_role;
grant execute on function public.fail_email(uuid, text) to service_role;

-- Počet e-mailů čekajících ve frontě pro event (pro informaci pořadateli)
create function public.event_email_queue_count(p_event_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_event_organizer(p_event_id) then raise exception 'not_allowed'; end if;
  return (
    select count(*) from public.email_outbox
    where status in ('queued', 'sending')
      and (payload ->> 'event_slug') = (select slug from public.events where id = p_event_id)
  );
end;
$$;

revoke execute on function public.event_email_queue_count(uuid) from public, anon;
grant execute on function public.event_email_queue_count(uuid) to authenticated;
