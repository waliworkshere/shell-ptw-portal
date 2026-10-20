-- Everything the signed-in person is allowed to see. Pass p_since to get
-- only what changed since the last call.
create or replace function public.gs_state(p_token text, p_since timestamptz default null) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare v_me jsonb := app.session_user(p_token); v_uid text; v_role text; v_records jsonb; v_cred app.credentials;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  v_uid := v_me->>'id'; v_role := v_me->>'role';
  select coalesce(jsonb_agg(jsonb_build_object(
      'c', r.collection, 'id', r.id, 'x', r.deleted,
      'd', case when r.deleted then null
                when r.collection = 'users' then app.view_user(r.data,
                  case when v_role = 'ADMIN' or r.id = v_uid then 'full' when app.is_staff(v_role) then 'staff' else 'basic' end)
                else r.data end)), '[]'::jsonb)
    into v_records
  from app.records r
  where (p_since is null or r.updated_at > p_since)
    and (r.deleted or app.can_read(r.collection, r.owner_id, r.data, v_uid, v_role))
    and (p_since is not null or not r.deleted);
  select * into v_cred from app.credentials where user_id = v_uid;
  return jsonb_build_object('ok', true, 'me', app.view_user(v_me, 'full'), 'mustChange', coalesce(v_cred.must_change, false),
    'records', v_records, 'serverTime', clock_timestamp());
end $$;

-- Saves changes made in the app. p_ops = [{c, id, d} | {c, id, del: true}]
create or replace function public.gs_sync(p_token text, p_ops jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me jsonb := app.session_user(p_token);
  v_uid text; v_role text; v_staff boolean; v_admin boolean;
  op jsonb; v_c text; v_id text; v_d jsonb; v_old jsonb; v_old_owner text; v_owner_f text; v_new_owner text;
  v_ok boolean; v_reason text; v_saved jsonb := '[]'::jsonb; v_rejected jsonb := '[]'::jsonb; f text;
  v_protected text[] := array['role','username','civilId','civilIdExpiry','stationId','imported','importedAt','importSource','passportNo','member','competencyRole'];
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  v_uid := v_me->>'id'; v_role := v_me->>'role'; v_staff := app.is_staff(v_role); v_admin := v_role = 'ADMIN';

  for op in select * from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb)) loop
    v_c := op->>'c'; v_id := op->>'id'; v_ok := false; v_reason := 'FORBIDDEN';
    select data, owner_id into v_old, v_old_owner from app.records where collection = v_c and id = v_id and not deleted;

    if coalesce((op->>'del')::boolean, false) then
      if v_admin and v_c <> 'users' or (v_admin and v_c = 'users' and v_id <> v_uid) then
        update app.records set deleted = true, updated_at = clock_timestamp(), updated_by = v_uid where collection = v_c and id = v_id;
        v_saved := v_saved || jsonb_build_object('c', v_c, 'id', v_id, 'x', true);
      else
        v_rejected := v_rejected || jsonb_build_object('c', v_c, 'id', v_id, 'reason', 'FORBIDDEN');
      end if;
      continue;
    end if;

    v_d := (op->'d') - 'password';
    if v_d is null or jsonb_typeof(v_d) <> 'object' or coalesce(v_d->>'id', '') <> v_id then
      v_rejected := v_rejected || jsonb_build_object('c', v_c, 'id', v_id, 'reason', 'BAD_RECORD');
      continue;
    end if;
    v_owner_f := app.owner_field(v_c);
    v_new_owner := case when v_owner_f is null then null else v_d->>v_owner_f end;

    if v_admin then
      v_ok := v_c in ('users','stations','permitTypes','applications','auditLogs','screenshotGallery','courses','enrollments',
                      'registrations','journeys','payments','hsseReports','sosAlerts','faceChecks','companies','ptwCards');
      if v_ok and v_c = 'users' and v_id = v_uid then v_d := jsonb_set(v_d, '{role}', '"ADMIN"'); end if;
    elsif v_c = 'users' then
      if v_old is not null and v_id = v_uid then
        v_ok := true;
        foreach f in array v_protected loop
          v_d := v_d - f;
          if v_old ? f then v_d := v_d || jsonb_build_object(f, v_old->f); end if;
        end loop;
      end if;
    elsif v_c in ('stations', 'permitTypes', 'courses', 'companies', 'ptwCards') then
      v_ok := false;
    elsif v_c = 'auditLogs' then
      v_ok := v_old is null;
      v_d := v_d || jsonb_build_object('actor', v_me->>'fullName');
    elsif v_c = 'screenshotGallery' then
      v_ok := v_staff;
    elsif v_c = 'applications' then
      if v_old is null then
        v_ok := v_new_owner = v_uid;
      else
        v_ok := v_staff or (v_old_owner = v_uid and v_new_owner = v_uid);
        if v_ok and not v_staff then
          if (v_d->>'status') is distinct from (v_old->>'status')
             and (v_d->>'status') not in ('DRAFT', 'SUBMITTED', 'RESUBMITTED', 'CANCELLED') then v_ok := false; v_reason := 'STATUS'; end if;
          if (v_d->>'permitNumber') is distinct from (v_old->>'permitNumber') then v_ok := false; v_reason := 'STATUS'; end if;
        end if;
      end if;
      if v_old is null and not v_staff and (v_d->>'status') not in ('DRAFT', 'SUBMITTED') then v_ok := false; v_reason := 'STATUS'; end if;
    elsif v_c = 'journeys' then
      if v_old is null then
        v_ok := v_new_owner = v_uid and (v_d->>'status') in ('DRAFT', 'SUBMITTED');
      else
        v_ok := v_staff or (v_old_owner = v_uid and v_new_owner = v_uid
          and ((v_d->>'status') = (v_old->>'status') or (v_d->>'status') in ('IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SUBMITTED')));
      end if;
    elsif v_c in ('hsseReports', 'sosAlerts') then
      if v_old is null then
        v_ok := v_new_owner is null or v_new_owner = v_uid;
      else
        v_ok := v_staff or (v_old_owner = v_uid and v_new_owner = v_uid);
      end if;
    elsif v_c in ('enrollments', 'faceChecks') then
      v_ok := v_new_owner = v_uid and (v_old is null or v_old_owner = v_uid);
    elsif v_c in ('payments', 'registrations') then
      v_ok := v_old is null and v_new_owner = v_uid;
    else
      v_ok := false; v_reason := 'UNKNOWN_COLLECTION';
    end if;

    if not v_ok then
      v_rejected := v_rejected || jsonb_build_object('c', v_c, 'id', v_id, 'reason', v_reason);
      continue;
    end if;

    foreach f in array app.number_fields(v_c) loop
      if v_d ? f and (v_old is null or (v_old->>f) is distinct from (v_d->>f)) then
        v_d := jsonb_set(v_d, array[f], to_jsonb(app.unique_number(v_c, f, v_id, v_d->>f)));
      end if;
    end loop;

    insert into app.records (collection, id, data, owner_id, deleted, updated_at, updated_by)
      values (v_c, v_id, v_d, v_new_owner, false, clock_timestamp(), v_uid)
      on conflict (collection, id) do update
        set data = excluded.data, owner_id = excluded.owner_id, deleted = false, updated_at = clock_timestamp(), updated_by = v_uid;

    v_saved := v_saved || jsonb_build_object('c', v_c, 'id', v_id,
      'd', case when v_c = 'users' then app.view_user(v_d, 'full') else v_d end);
  end loop;

  return jsonb_build_object('ok', true, 'saved', v_saved, 'rejected', v_rejected, 'serverTime', clock_timestamp());
end $$;

-- Approved company names for the sign-up dropdown (no sign-in needed).
create or replace function public.gs_public_companies() returns jsonb
language sql security definer stable set search_path = '' as $$
  select coalesce(jsonb_agg(data order by data->>'name'), '[]'::jsonb)
  from app.records where collection = 'companies' and not deleted and data->>'status' = 'APPROVED'
$$;

-- Public QR check of a Safety Passport / PTW card. Returns only what a
-- station needs to confirm someone is cleared to work.
create or replace function public.gs_verify(p_number text) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare v_user jsonb; v_uid text;
begin
  select data into v_user from app.records u
   where u.collection = 'users' and not u.deleted
     and (u.data->>'passportNo' = p_number
          or ('SP-OM-' || lpad(right(regexp_replace(coalesce(nullif(u.data->>'civilId', ''), u.id), '\D', '', 'g'), 6), 6, '0')) = p_number
          or u.id = (select owner_id from app.records c where c.collection = 'ptwCards' and not c.deleted and c.data->>'cardNo' = p_number limit 1))
   limit 1;
  if v_user is null then return jsonb_build_object('ok', false); end if;
  v_uid := v_user->>'id';
  return jsonb_build_object('ok', true,
    'user', jsonb_strip_nulls(jsonb_build_object('id', v_uid, 'fullName', v_user->'fullName', 'company', v_user->'company',
      'jobTitle', v_user->'jobTitle', 'role', v_user->'role', 'civilId', right(coalesce(v_user->>'civilId', ''), 4), 'passportNo', v_user->'passportNo',
      'facePhoto', v_user->'facePhoto', 'username', '', 'password', '', 'email', '', 'civilIdExpiry', '')),
    'enrollments', coalesce((select jsonb_agg(data) from app.records where collection = 'enrollments' and not deleted and owner_id = v_uid), '[]'::jsonb),
    'courses', coalesce((select jsonb_agg(jsonb_build_object('id', data->'id', 'code', data->'code', 'title', data->'title', 'source', data->'source',
        'status', data->'status', 'mandatory', data->'mandatory', 'pathOrder', data->'pathOrder', 'validityMonths', data->'validityMonths',
        'lessons', '[]'::jsonb)) from app.records where collection = 'courses' and not deleted), '[]'::jsonb),
    'ptwCards', coalesce((select jsonb_agg(data) from app.records where collection = 'ptwCards' and not deleted and owner_id = v_uid), '[]'::jsonb));
end $$;
