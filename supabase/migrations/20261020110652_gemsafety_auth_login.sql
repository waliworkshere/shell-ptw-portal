create or replace function public.gs_login(p_login text, p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid text; v_cred app.credentials;
begin
  v_uid := app.user_by_login(p_login);
  if v_uid is null then
    perform pg_sleep(0.3);
    return jsonb_build_object('ok', false, 'error', 'INVALID');
  end if;
  select * into v_cred from app.credentials where user_id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_ACTIVATED');
  end if;
  if v_cred.locked_until is not null and v_cred.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'LOCKED');
  end if;
  if v_cred.password_hash <> extensions.crypt(coalesce(p_password, ''), v_cred.password_hash) then
    update app.credentials
      set failed_attempts = failed_attempts + 1,
          locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end,
          updated_at = now()
      where user_id = v_uid;
    return jsonb_build_object('ok', false, 'error', 'INVALID');
  end if;
  update app.credentials set failed_attempts = 0, locked_until = null, updated_at = now() where user_id = v_uid;
  return jsonb_build_object('ok', true, 'token', app.new_session(v_uid), 'mustChange', v_cred.must_change);
end $$;

-- Civil ID lookup for the sign-up page. Reveals only whether an account
-- exists, never who it belongs to.
create or replace function public.gs_check_civil(p_civil_id text) returns text
language sql security definer stable set search_path = '' as $$
  select case
    when r.id is null then 'NOT_FOUND'
    when c.user_id is null then 'NEEDS_ACTIVATION'
    else 'ACTIVE' end
  from (select 1) x
  left join app.records r on r.collection = 'users' and not r.deleted and r.data->>'civilId' = trim(p_civil_id) and trim(p_civil_id) <> ''
  left join app.credentials c on c.user_id = r.id
  limit 1
$$;
