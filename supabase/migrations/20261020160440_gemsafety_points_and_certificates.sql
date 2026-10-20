-- Reward points for SOS / HSSE reports, redemptions, and certificates people
-- upload for checking (read with OCR in the app).

create or replace function app.owner_field(p_collection text) returns text
language sql immutable set search_path = '' as $$
  select case p_collection
    when 'users' then 'id'
    when 'applications' then 'applicantId'
    when 'enrollments' then 'userId'
    when 'payments' then 'userId'
    when 'registrations' then 'userId'
    when 'faceChecks' then 'userId'
    when 'sosAlerts' then 'userId'
    when 'ptwCards' then 'userId'
    when 'certUploads' then 'userId'
    when 'redemptions' then 'userId'
    when 'journeys' then 'driverId'
    when 'hsseReports' then 'reporterId'
    else null end
$$;

create or replace function app.can_read(p_collection text, p_owner text, p_data jsonb, p_uid text, p_role text) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when p_role = 'ADMIN' then true
    when p_collection in ('stations', 'permitTypes', 'courses', 'companies') then true
    when p_collection = 'users' then app.is_staff(p_role) or p_owner = p_uid or (p_data->>'role') in ('ADMIN', 'APPROVER', 'STATION')
    when p_collection = 'auditLogs' then false
    when p_collection = 'payments' then p_owner = p_uid
    when p_collection = 'screenshotGallery' then app.is_staff(p_role)
    when p_collection in ('applications', 'journeys', 'hsseReports', 'sosAlerts', 'enrollments', 'registrations', 'faceChecks', 'ptwCards', 'certUploads')
      then app.is_staff(p_role) or p_owner = p_uid
    else p_owner = p_uid
  end
$$;

-- Saves changes made in the app. p_ops = [{c, id, d} | {c, id, del: true}]
create or replace function public.gs_sync(p_token text, p_ops jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me jsonb := app.session_user(p_token);
  v_uid text; v_role text; v_staff boolean; v_admin boolean;
  op jsonb; v_c text; v_id text; v_d jsonb; v_old jsonb; v_old_owner text; v_owner_f text; v_new_owner text;
  v_ok boolean; v_reason text; v_saved jsonb := '[]'::jsonb; v_rejected jsonb := '[]'::jsonb; f text;
  v_protected text[] := array['role','username','civilId','civilIdExpiry','stationId','imported','importedAt','importSource','passportNo','member','competencyRole'];
  v_points text[] := array['points','pointsStatus','pointsDecidedAt','pointsDecidedBy','pointsNote'];
  v_earned int; v_spent int;
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
                      'registrations','journeys','payments','hsseReports','sosAlerts','faceChecks','companies','ptwCards',
                      'certUploads','redemptions');
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
      -- Reward points on a report are decided by an administrator only.
      if v_c = 'hsseReports' then
        foreach f in array v_points loop
          v_d := v_d - f;
          if v_old is not null and v_old ? f then v_d := v_d || jsonb_build_object(f, v_old->f); end if;
        end loop;
      end if;
    elsif v_c = 'certUploads' then
      -- People submit their own certificates for checking; only an administrator verifies them.
      v_ok := v_new_owner = v_uid and (v_d->>'status') = 'PENDING'
        and (v_old is null or (v_old_owner = v_uid and (v_old->>'status') in ('PENDING', 'REJECTED')));
    elsif v_c = 'redemptions' then
      if v_old is null then
        select coalesce(sum(case when (data->>'points') ~ '^\d+$' then (data->>'points')::int else 0 end), 0) into v_earned
          from app.records where collection = 'hsseReports' and not deleted and owner_id = v_uid and data->>'pointsStatus' = 'APPROVED';
        select coalesce(sum(case when (data->>'cost') ~ '^\d+$' then (data->>'cost')::int else 0 end), 0) into v_spent
          from app.records where collection = 'redemptions' and not deleted and owner_id = v_uid and data->>'status' in ('PENDING', 'FULFILLED');
        v_ok := v_new_owner = v_uid and (v_d->>'status') = 'PENDING' and coalesce(v_d->>'cost', '') ~ '^\d+$'
          and (v_d->>'cost')::int > 0 and v_earned - v_spent >= (v_d->>'cost')::int;
        if not v_ok then v_reason := 'POINTS'; end if;
      else
        -- The requester may only withdraw a request that is still pending.
        v_ok := v_old_owner = v_uid and v_new_owner = v_uid and (v_old->>'status') = 'PENDING' and (v_d->>'status') = 'CANCELLED'
          and (v_d->>'cost') = (v_old->>'cost') and (v_d->>'rewardId') = (v_old->>'rewardId');
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

