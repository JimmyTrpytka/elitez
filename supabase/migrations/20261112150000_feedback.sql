-- =====================================================================
-- Testovací provoz: připomínky od testerů
-- Kdokoli (i nepřihlášený) může poslat připomínku přes funkci submit_feedback.
-- Číst je smí jen admin. Admin dostane upozornění e-mailem.
-- =====================================================================

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  contact_email text check (char_length(contact_email) <= 254),
  page_path text check (char_length(page_path) <= 300),
  message text not null check (char_length(message) between 3 and 4000),
  user_agent text check (char_length(user_agent) <= 400),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

create policy "feedback: admin reads"
  on public.feedback for select
  to authenticated
  using ((select public.is_admin()));

revoke insert, update, delete on public.feedback from anon, authenticated;

-- Odeslání připomínky (s ochranou proti zahlcení)
create function public.submit_feedback(
  p_message text,
  p_page_path text,
  p_contact_email text,
  p_user_agent text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_admin record;
begin
  if char_length(trim(coalesce(p_message, ''))) not between 3 and 4000 then
    raise exception 'invalid_message';
  end if;

  -- Limit: přihlášený 20/den, celkově 200/hodinu
  if v_uid is not null and (
    select count(*) from public.feedback
    where user_id = v_uid and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'rate_limited';
  end if;
  if (select count(*) from public.feedback where created_at > now() - interval '1 hour') >= 200 then
    raise exception 'rate_limited';
  end if;

  insert into public.feedback (user_id, contact_email, page_path, message, user_agent)
  values (
    v_uid,
    nullif(left(trim(coalesce(p_contact_email, '')), 254), ''),
    left(coalesce(p_page_path, ''), 300),
    trim(p_message),
    left(coalesce(p_user_agent, ''), 400)
  )
  returning id into v_id;

  -- E-mail adminům
  for v_admin in
    select u.email, p.locale
    from public.profiles p join auth.users u on u.id = p.id
    where p.role = 'admin' and u.email is not null
  loop
    insert into public.email_outbox (to_email, locale, template, payload)
    values (
      v_admin.email,
      v_admin.locale,
      'feedback',
      jsonb_build_object(
        'message', left(trim(p_message), 4000),
        'page', left(coalesce(p_page_path, ''), 300),
        'from', coalesce(
          (select coalesce(display_name, username) from public.profiles where id = v_uid),
          nullif(trim(coalesce(p_contact_email, '')), ''),
          '—'
        )
      )
    );
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.submit_feedback(text, text, text, text) from public;
grant execute on function public.submit_feedback(text, text, text, text) to anon, authenticated;

-- Admin označí připomínku jako vyřešenou
create function public.resolve_feedback(p_id uuid, p_resolved boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  update public.feedback
  set resolved_at = case when p_resolved then now() else null end
  where id = p_id;
end;
$$;

revoke execute on function public.resolve_feedback(uuid, boolean) from public, anon;
grant execute on function public.resolve_feedback(uuid, boolean) to authenticated;
