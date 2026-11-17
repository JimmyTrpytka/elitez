-- =====================================================================
-- Registrace na srazy – vylepšení, část 2 (SPEC 5.1k, body F a G)
-- Interní hodnocení 1–5 hvězd a koncepty rozhodnutí s odesláním najednou.
-- Obojí je v samostatné tabulce, kterou čte jen pořadatel – uchazeč čte
-- svůj řádek v event_registrations, proto tam koncept být nesmí.
-- =====================================================================

alter table public.events
  add column hold_decisions boolean not null default false;

create table public.event_registration_reviews (
  registration_id uuid primary key references public.event_registrations (id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  draft_status public.registration_status
    check (draft_status in ('approved', 'rejected', 'waitlist')),
  draft_reason public.rejection_reason,
  draft_message text check (char_length(draft_message) <= 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.event_registration_reviews enable row level security;

create policy "registration reviews: organizer reads"
  on public.event_registration_reviews for select
  to authenticated
  using (public.is_registration_organizer(registration_id) or (select public.is_admin()));

-- Zápis jen funkcemi níže
revoke insert, update, delete on public.event_registration_reviews from anon, authenticated;

-- ---------------------------------------------------------------------
-- Skutečné provedení rozhodnutí (interní; oprávnění kontroluje volající).
-- Při plné kapacitě se „schválit“ změní na čekací listinu.
-- ---------------------------------------------------------------------
create function public.apply_registration_decision(
  p_registration_id uuid,
  p_decision public.registration_status,
  p_reason public.rejection_reason,
  p_message text
)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_registrations;
  v_capacity integer;
  v_target public.registration_status := p_decision;
  v_was_approved boolean;
begin
  select * into v_row from public.event_registrations where id = p_registration_id;
  if v_row.status = 'cancelled' then return v_row; end if;
  select capacity into v_capacity from public.events where id = v_row.event_id;
  v_was_approved := v_row.status = 'approved';

  if v_target = 'approved' and not v_was_approved and v_capacity is not null and (
    select count(*) from public.event_registrations
    where event_id = v_row.event_id and status = 'approved'
  ) >= v_capacity then
    v_target := 'waitlist';
  end if;

  update public.event_registrations
  set status = v_target,
      rejection_reason = case when v_target = 'rejected' then coalesce(p_reason, 'other') else null end,
      decision_message = case when v_target = 'rejected'
        then nullif(trim(coalesce(p_message, '')), '') else null end,
      decided_at = now(),
      decided_by = auth.uid()
  where id = p_registration_id
  returning * into v_row;

  if v_was_approved and v_target <> 'approved' then
    perform public.fill_from_waitlist(v_row.event_id);
    select * into v_row from public.event_registrations where id = p_registration_id;
  end if;
  return v_row;
end;
$$;

revoke execute on function public.apply_registration_decision(uuid, public.registration_status, public.rejection_reason, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Rozhodnutí pořadatele. U eventu s „odeslat najednou“ se schválení,
-- zamítnutí i čekací listina uloží jen jako koncept (uchazeč nic nevidí).
-- „Vrátit k posouzení“ u konceptu jen zahodí koncept, jinak vrátí skutečný stav.
-- ---------------------------------------------------------------------
create or replace function public.decide_registration(
  p_registration_id uuid,
  p_decision public.registration_status,
  p_reason public.rejection_reason default null,
  p_message text default null
)
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
  if not found or not public.is_event_organizer(v_row.event_id) then
    raise exception 'not_allowed';
  end if;
  if p_decision not in ('approved', 'rejected', 'waitlist', 'pending') then
    raise exception 'invalid_decision';
  end if;
  if v_row.status = 'cancelled' then raise exception 'cancelled'; end if;
  if char_length(coalesce(p_message, '')) > 1000 then raise exception 'message_too_long'; end if;

  select * into v_event from public.events where id = v_row.event_id for update;

  if v_event.hold_decisions and p_decision <> 'pending' then
    if p_decision = v_row.status then
      -- Stejné jako skutečný stav → koncept není potřeba
      update public.event_registration_reviews
      set draft_status = null, draft_reason = null, draft_message = null,
          updated_at = now(), updated_by = auth.uid()
      where registration_id = p_registration_id;
    else
      insert into public.event_registration_reviews (
        registration_id, draft_status, draft_reason, draft_message, updated_by
      ) values (
        p_registration_id, p_decision,
        case when p_decision = 'rejected' then coalesce(p_reason, 'other') end,
        case when p_decision = 'rejected' then nullif(trim(coalesce(p_message, '')), '') end,
        auth.uid()
      )
      on conflict (registration_id) do update
      set draft_status = excluded.draft_status,
          draft_reason = excluded.draft_reason,
          draft_message = excluded.draft_message,
          updated_at = now(),
          updated_by = excluded.updated_by;
    end if;
    return v_row;
  end if;

  -- „Vrátit k posouzení“ u konceptu jen zahodí koncept (skutečný stav zůstává)
  if p_decision = 'pending' and exists (
    select 1 from public.event_registration_reviews
    where registration_id = p_registration_id and draft_status is not null
  ) then
    update public.event_registration_reviews
    set draft_status = null, draft_reason = null, draft_message = null,
        updated_at = now(), updated_by = auth.uid()
    where registration_id = p_registration_id;
    return v_row;
  end if;

  update public.event_registration_reviews
  set draft_status = null, draft_reason = null, draft_message = null,
      updated_at = now(), updated_by = auth.uid()
  where registration_id = p_registration_id;

  return public.apply_registration_decision(p_registration_id, p_decision, p_reason, p_message);
end;
$$;

-- ---------------------------------------------------------------------
-- Odeslání všech konceptů eventu najednou. Pořadí: zamítnutí, čekací
-- listina, schválení (Verified první při „upřednostnit Verified“, pak podle
-- času přihlášky) – schválení nad kapacitu skončí na čekací listině.
-- Vrací počet odeslaných rozhodnutí.
-- ---------------------------------------------------------------------
create function public.release_registration_decisions(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_item record;
  v_count integer := 0;
begin
  if not public.is_event_organizer(p_event_id) then raise exception 'not_allowed'; end if;
  select * into v_event from public.events where id = p_event_id for update;

  for v_item in
    select r.id, rv.draft_status, rv.draft_reason, rv.draft_message
    from public.event_registration_reviews rv
    join public.event_registrations r on r.id = rv.registration_id
    join public.profiles p on p.id = r.user_id
    where r.event_id = p_event_id
      and rv.draft_status is not null
      and r.status <> 'cancelled'
    order by
      case rv.draft_status when 'rejected' then 0 when 'waitlist' then 1 else 2 end,
      case when v_event.verified_priority and p.verified_at is not null then 0 else 1 end,
      r.created_at
  loop
    perform public.apply_registration_decision(
      v_item.id, v_item.draft_status, v_item.draft_reason, v_item.draft_message
    );
    v_count := v_count + 1;
  end loop;

  update public.event_registration_reviews rv
  set draft_status = null, draft_reason = null, draft_message = null,
      updated_at = now(), updated_by = auth.uid()
  from public.event_registrations r
  where r.id = rv.registration_id and r.event_id = p_event_id and rv.draft_status is not null;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Interní hodnocení 1–5 hvězd (null = smazat)
-- ---------------------------------------------------------------------
create function public.set_registration_rating(p_registration_id uuid, p_rating smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_registration_organizer(p_registration_id) then raise exception 'not_allowed'; end if;
  if p_rating is not null and p_rating not between 1 and 5 then raise exception 'invalid_rating'; end if;
  insert into public.event_registration_reviews (registration_id, rating, updated_by)
  values (p_registration_id, p_rating, auth.uid())
  on conflict (registration_id) do update
  set rating = excluded.rating, updated_at = now(), updated_by = excluded.updated_by;
end;
$$;

revoke execute on function public.release_registration_decisions(uuid) from public, anon;
revoke execute on function public.set_registration_rating(uuid, smallint) from public, anon;
grant execute on function public.release_registration_decisions(uuid) to authenticated;
grant execute on function public.set_registration_rating(uuid, smallint) to authenticated;
