-- =====================================================================
-- Správa uživatelů (admin) a veřejný seznam členů
-- =====================================================================

-- ---------------------------------------------------------------------
-- Admin: seznam všech uživatelů (včetně e-mailu) s vyhledáváním
-- ---------------------------------------------------------------------
create function public.admin_list_users(p_search text default null, p_limit integer default 200)
returns table (
  id uuid,
  username text,
  display_name text,
  email text,
  role text,
  verified_at timestamptz,
  visibility public.visibility,
  organizer_status public.organizer_status,
  organizer_name text,
  vehicle_count bigint,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  return query
  select
    p.id,
    p.username,
    p.display_name,
    u.email::text,
    p.role,
    p.verified_at,
    p.visibility,
    o.status,
    o.name,
    (select count(*) from public.vehicles v where v.owner_id = p.id),
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at is not null
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.organizers o on o.profile_id = p.id
  where p_search is null or trim(p_search) = ''
     or p.username ilike '%' || trim(p_search) || '%'
     or p.display_name ilike '%' || trim(p_search) || '%'
     or u.email ilike '%' || trim(p_search) || '%'
  order by u.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: udělit / odebrat roli administrátora (sám sobě odebrat nejde)
-- ---------------------------------------------------------------------
create function public.admin_set_admin(p_user_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  if p_user_id = auth.uid() and not p_enabled then raise exception 'cannot_demote_self'; end if;
  update public.profiles
  set role = case when p_enabled then 'admin' else 'member' end
  where id = p_user_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: udělit / odebrat roli pořadatele
-- Udělení založí (nebo znovu schválí) pořadatelský profil.
-- Odebrání ho jen POZASTAVÍ – eventy a přihlášky zůstanou zachované.
-- ---------------------------------------------------------------------
create function public.admin_set_organizer(p_user_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  select coalesce(display_name, username, 'Pořadatel') into v_name
  from public.profiles where id = p_user_id;
  if not found then raise exception 'not_found'; end if;

  if p_enabled then
    insert into public.organizers (profile_id, name, status)
    values (p_user_id, left(v_name, 80), 'approved')
    on conflict (profile_id) do update set status = 'approved';
  else
    update public.organizers set status = 'suspended' where profile_id = p_user_id;
  end if;
end;
$$;

revoke execute on function public.admin_list_users(text, integer) from public, anon;
revoke execute on function public.admin_set_admin(uuid, boolean) from public, anon;
revoke execute on function public.admin_set_organizer(uuid, boolean) from public, anon;
grant execute on function public.admin_list_users(text, integer) to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
grant execute on function public.admin_set_organizer(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Veřejný seznam členů: jen veřejné profily s uživatelským jménem,
-- počet jen veřejných aktuálních vozidel. Bez e-mailů a soukromých dat.
-- ---------------------------------------------------------------------
create function public.public_members(
  p_search text default null,
  p_limit integer default 60,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  display_name text,
  country text,
  city text,
  avatar_path text,
  verified_at timestamptz,
  vehicle_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.username, p.display_name, p.country, p.city, p.avatar_path, p.verified_at,
    (select count(*) from public.vehicles v
      where v.owner_id = p.id and v.visibility = 'public' and v.status = 'current'),
    p.created_at
  from public.profiles p
  where p.visibility = 'public'
    and p.username is not null
    and (
      p_search is null or trim(p_search) = ''
      or p.username ilike '%' || trim(p_search) || '%'
      or p.display_name ilike '%' || trim(p_search) || '%'
      or p.city ilike '%' || trim(p_search) || '%'
    )
  order by
    (select count(*) from public.vehicles v
      where v.owner_id = p.id and v.visibility = 'public' and v.status = 'current') desc,
    p.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.public_members(text, integer, integer) from public;
grant execute on function public.public_members(text, integer, integer) to anon, authenticated;
