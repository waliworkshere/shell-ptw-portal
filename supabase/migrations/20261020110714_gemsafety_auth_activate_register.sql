-- First sign-in for members imported from the existing register: prove
-- identity with Civil ID + date of birth, then choose a password.
create or replace function public.gs_activate(p_civil_id text, p_dob text, p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user app.records; v_att app.activation_attempts;
begin
  if length(coalesce(p_password, '')) < 8 then
    return jsonb_build_object('ok', false, 'error', 'WEAK_PASSWORD');
  end if;
  select * into v_att from app.activation_attempts where civil_id = trim(p_civil_id);
  if found and v_att.locked_until is not null and v_att.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'LOCKED');
  end if;
  select * into v_user from app.records
    where collection = 'users' and not deleted and data->>'civilId' = trim(p_civil_id) and trim(p_civil_id) <> '' limit 1;
  if not found or exists (select 1 from app.credentials where user_id = v_user.id)
     or coalesce(v_user.data->'member'->>'dob', '') = '' or (v_user.data->'member'->>'dob') <> trim(p_dob) then
    insert into app.activation_attempts (civil_id, failures) values (trim(p_civil_id), 1)
      on conflict (civil_id) do update set failures = app.activation_attempts.failures + 1,
        locked_until = case when app.activation_attempts.failures + 1 >= 5 then now() + interval '1 hour' else null end;
    perform pg_sleep(0.3);
    return jsonb_build_object('ok', false, 'error', 'NO_MATCH');
  end if;
  update app.activation_attempts set failures = 0, locked_until = null where civil_id = trim(p_civil_id);
  insert into app.credentials (user_id, login, password_hash)
    values (v_user.id, lower(trim(p_civil_id)), extensions.crypt(p_password, extensions.gen_salt('bf', 10)));
  update app.records set data = data || jsonb_build_object('username', trim(p_civil_id)), updated_at = clock_timestamp()
    where collection = 'users' and id = v_user.id;
  perform app.audit(v_user.data->>'fullName', 'ACCOUNT_ACTIVATED', (v_user.data->>'fullName') || ' activated their imported account');
  return jsonb_build_object('ok', true, 'token', app.new_session(v_user.id), 'mustChange', false);
end $$;

-- New account (people not on the imported register).
create or replace function public.gs_register(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id text; v_user jsonb; v_login text := lower(trim(coalesce(p->>'username', '')));
begin
  if length(coalesce(p->>'password', '')) < 8 then return jsonb_build_object('ok', false, 'error', 'WEAK_PASSWORD'); end if;
  if coalesce(trim(p->>'fullName'), '') = '' or coalesce(trim(p->>'civilId'), '') = '' or v_login = '' then
    return jsonb_build_object('ok', false, 'error', 'MISSING');
  end if;
  if v_login !~ '^[a-z0-9._@-]{3,60}$' then return jsonb_build_object('ok', false, 'error', 'BAD_USERNAME'); end if;
  if exists (select 1 from app.records where collection = 'users' and not deleted and data->>'civilId' = trim(p->>'civilId')) then
    return jsonb_build_object('ok', false, 'error', 'CIVIL_EXISTS');
  end if;
  if exists (select 1 from app.credentials where login = v_login) then
    return jsonb_build_object('ok', false, 'error', 'USERNAME_TAKEN');
  end if;
  if not exists (select 1 from app.records where collection = 'companies' and not deleted
                 and data->>'status' = 'APPROVED' and data->>'name' = p->>'company') then
    return jsonb_build_object('ok', false, 'error', 'COMPANY');
  end if;
  v_id := 'u-' || encode(extensions.gen_random_bytes(8), 'hex');
  v_user := jsonb_build_object(
    'id', v_id, 'fullName', trim(p->>'fullName'), 'email', coalesce(trim(p->>'email'), ''), 'phone', coalesce(trim(p->>'phone'), ''),
    'company', p->>'company', 'civilId', trim(p->>'civilId'), 'civilIdExpiry', coalesce(p->>'civilIdExpiry', ''),
    'username', trim(p->>'username'), 'password', '', 'role', 'TRAINEE');
  insert into app.records (collection, id, data, owner_id, updated_by) values ('users', v_id, v_user, v_id, v_id);
  insert into app.credentials (user_id, login, password_hash) values (v_id, v_login, extensions.crypt(p->>'password', extensions.gen_salt('bf', 10)));
  perform app.audit(v_user->>'fullName', 'ACCOUNT_REGISTERED', (v_user->>'fullName') || ' created an account (' || (v_user->>'company') || ')');
  return jsonb_build_object('ok', true, 'token', app.new_session(v_id), 'mustChange', false);
end $$;
