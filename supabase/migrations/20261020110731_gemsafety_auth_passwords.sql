create or replace function public.gs_logout(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update app.sessions set expires_at = now() where token_hash = app.hash_token(p_token);
end $$;

create or replace function public.gs_change_password(p_token text, p_old text, p_new text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_me jsonb := app.session_user(p_token); v_cred app.credentials;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  if length(coalesce(p_new, '')) < 8 then return jsonb_build_object('ok', false, 'error', 'WEAK_PASSWORD'); end if;
  select * into v_cred from app.credentials where user_id = v_me->>'id';
  if not found or v_cred.password_hash <> extensions.crypt(coalesce(p_old, ''), v_cred.password_hash) then
    return jsonb_build_object('ok', false, 'error', 'INVALID');
  end if;
  update app.credentials set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)), must_change = false, updated_at = now()
    where user_id = v_me->>'id';
  update app.sessions set expires_at = now() where user_id = v_me->>'id' and token_hash <> app.hash_token(p_token) and expires_at > now();
  return jsonb_build_object('ok', true);
end $$;

-- Admin: set a temporary password for anyone (also gives sign-in to people
-- the admin added by hand). They must change it at next sign-in.
create or replace function public.gs_admin_set_password(p_token text, p_user_id text, p_password text, p_login text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_me jsonb := app.session_user(p_token); v_user jsonb; v_login text;
begin
  if v_me is null or v_me->>'role' <> 'ADMIN' then return jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); end if;
  if length(coalesce(p_password, '')) < 8 then return jsonb_build_object('ok', false, 'error', 'WEAK_PASSWORD'); end if;
  select data into v_user from app.records where collection = 'users' and id = p_user_id and not deleted;
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  v_login := lower(trim(coalesce(nullif(p_login, ''), nullif(v_user->>'username', ''), nullif(v_user->>'civilId', ''), v_user->>'email')));
  if exists (select 1 from app.credentials where login = v_login and user_id <> p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'USERNAME_TAKEN');
  end if;
  insert into app.credentials (user_id, login, password_hash, must_change)
    values (p_user_id, v_login, extensions.crypt(p_password, extensions.gen_salt('bf', 10)), true)
    on conflict (user_id) do update set login = excluded.login, password_hash = excluded.password_hash,
      must_change = true, failed_attempts = 0, locked_until = null, updated_at = now();
  update app.sessions set expires_at = now() where user_id = p_user_id and expires_at > now();
  update app.records set data = data || jsonb_build_object('username', v_login), updated_at = clock_timestamp()
    where collection = 'users' and id = p_user_id;
  perform app.audit(v_me->>'fullName', 'PASSWORD_SET', 'Temporary password set for ' || (v_user->>'fullName'));
  return jsonb_build_object('ok', true, 'login', v_login);
end $$;
