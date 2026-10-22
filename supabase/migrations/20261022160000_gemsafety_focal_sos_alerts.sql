-- =====================================================================
-- Gemsafety: HSSE Focals are looped into SOS reports.
--  * The reporter's company is stamped on every SOS report; that company's
--    HSSE Focal is alerted (email + in-app) alongside the administrators.
--  * A corrective action can be assigned to another company; that company's
--    HSSE Focal is alerted and can mark the action done.
-- =====================================================================

/** Is an HSSE Focal of p_company looped into this SOS report? */
create or replace function app.focal_sees(p_data jsonb, p_company text) returns boolean
language sql immutable set search_path = '' as $$
  select p_company is not null and p_company <> '' and (
    p_data->>'reporterCompany' = p_company
    or exists (select 1 from jsonb_array_elements(coalesce(p_data->'actions', '[]'::jsonb)) a
               where coalesce(nullif(a->>'company', ''), p_data->>'reporterCompany') = p_company))
$$;

create or replace function public.gs_state(p_token text, p_since timestamptz default null) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare v_me jsonb := app.session_user(p_token); v_uid text; v_role text; v_records jsonb; v_cred app.credentials; v_focal_co text;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  v_uid := v_me->>'id'; v_role := v_me->>'role';
  v_focal_co := case when coalesce((v_me->'hsseFocal'->>'active')::boolean, false) then nullif(v_me->'hsseFocal'->>'company', '') end;
  select coalesce(jsonb_agg(jsonb_build_object(
      'c', r.collection, 'id', r.id, 'x', r.deleted,
      'd', case when r.deleted then null
                when r.collection = 'users' then app.view_user(r.data,
                  case when v_role = 'ADMIN' or r.id = v_uid then 'full' when app.is_staff(v_role) then 'staff' else 'basic' end)
                else r.data end)), '[]'::jsonb)
    into v_records
  from app.records r
  where (p_since is null or r.updated_at > p_since)
    and (r.deleted or app.can_read(r.collection, r.owner_id, r.data, v_uid, v_role)
         or (r.collection = 'hsseReports' and v_focal_co is not null and app.focal_sees(r.data, v_focal_co)))
    and (p_since is not null or not r.deleted);
  select * into v_cred from app.credentials where user_id = v_uid;
  return jsonb_build_object('ok', true, 'me', app.view_user(v_me, 'full'), 'mustChange', coalesce(v_cred.must_change, false),
    'records', v_records, 'serverTime', clock_timestamp());
end $$;

create or replace function public.gs_sync(p_token text, p_ops jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me jsonb := app.session_user(p_token);
  v_uid text; v_role text; v_staff boolean; v_admin boolean;
  op jsonb; v_c text; v_id text; v_d jsonb; v_old jsonb; v_old_owner text; v_owner_f text; v_new_owner text;
  v_ok boolean; v_reason text; v_saved jsonb := '[]'::jsonb; v_rejected jsonb := '[]'::jsonb; f text;
  v_protected text[] := array['role','username','civilId','civilIdExpiry','stationId','imported','importedAt','importSource','passportNo','member','competencyRole','hsseFocal'];
  v_points text[] := array['points','pointsStatus','pointsDecidedAt','pointsDecidedBy','pointsNote'];
  v_earned int; v_spent int;
  v_focal_co text; v_a jsonb; v_b jsonb;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  v_uid := v_me->>'id'; v_role := v_me->>'role'; v_staff := app.is_staff(v_role); v_admin := v_role = 'ADMIN';
  v_focal_co := case when coalesce((v_me->'hsseFocal'->>'active')::boolean, false) then nullif(v_me->'hsseFocal'->>'company', '') end;

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
                      'certUploads','redemptions','focalReports');
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
      if v_c = 'hsseReports' then
        -- The reporter's company is stamped by the server so that company's HSSE Focal is alerted.
        if v_old is null then
          v_d := v_d - 'reporterCompany';
          if coalesce(v_me->>'company', '') <> '' then v_d := v_d || jsonb_build_object('reporterCompany', v_me->>'company'); end if;
        elsif not v_staff then
          v_d := v_d - 'reporterCompany';
          if v_old ? 'reporterCompany' then v_d := v_d || jsonb_build_object('reporterCompany', v_old->'reporterCompany'); end if;
        end if;
        -- An HSSE Focal looped into a report may mark their own company's actions done (and add to the timeline), nothing else.
        if not v_ok and v_old is not null and v_focal_co is not null and app.focal_sees(v_old, v_focal_co) then
          v_ok := (v_d - 'actions' - 'timeline') = (v_old - 'actions' - 'timeline')
            and jsonb_array_length(coalesce(v_d->'actions', '[]')) = jsonb_array_length(coalesce(v_old->'actions', '[]'))
            and coalesce(v_d->'timeline', '[]') @> coalesce(v_old->'timeline', '[]');
          if v_ok then
            for v_a in select * from jsonb_array_elements(coalesce(v_old->'actions', '[]')) loop
              v_b := null;
              select x into v_b from jsonb_array_elements(coalesce(v_d->'actions', '[]')) x where x->>'id' = v_a->>'id';
              if v_b is null then v_ok := false; exit; end if;
              if coalesce(nullif(v_a->>'company', ''), v_old->>'reporterCompany') = v_focal_co then
                if (v_b - 'done' - 'doneBy' - 'doneAt') <> (v_a - 'done' - 'doneBy' - 'doneAt') then v_ok := false; exit; end if;
              elsif v_b <> v_a then
                v_ok := false; exit;
              end if;
            end loop;
          end if;
          if v_ok then v_new_owner := v_old_owner; end if;
        end if;
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
    elsif v_c = 'focalReports' then
      -- Only people appointed as HSSE Focal by an Administrator file focal reports, and only their own.
      v_ok := coalesce((v_me->'hsseFocal'->>'active')::boolean, false) and v_new_owner = v_uid
        and (v_old is null or v_old_owner = v_uid);
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

/** Emails to HSSE Focals: their company reported something, or an action was assigned to their company. */
create or replace function app.focal_emails(p_company text) returns text[]
language sql stable security definer set search_path = app, public as $$
  select coalesce(array_agg(data->>'email'), '{}') from app.records
  where collection = 'users' and not deleted and coalesce((data->'hsseFocal'->>'active')::boolean, false)
    and data->'hsseFocal'->>'company' = p_company and coalesce(data->>'email', '') like '%@%'
$$;

create or replace function app.focal_names(p_company text) returns text
language sql stable security definer set search_path = app, public as $$
  select string_agg(data->>'fullName', ', ') from app.records
  where collection = 'users' and not deleted and coalesce((data->'hsseFocal'->>'active')::boolean, false)
    and data->'hsseFocal'->>'company' = p_company
$$;

create or replace function app.notify_focal(p_id text, d jsonb, o jsonb) returns void
language plpgsql security definer set search_path = app, public as $$
declare
  url text := app.email_setting('app_url') #>> '{}';
  co text := d->>'reporterCompany';
  names text;
  a jsonb;
  aco text;
begin
  -- New report: alert the reporter's company focal in parallel with the administrators.
  if o is null and coalesce(co, '') <> '' then
    names := app.focal_names(co);
    if names is not null then
      perform app.queue_email('hsse-focal:' || p_id, 'SOS_REPORT_FOCAL', 'hsseReports', p_id,
        'SOS report from ' || co || ': ' || coalesce(d->>'refNo', '') || ' ' || coalesce(d->>'title', ''),
        app.email_html('HSSE Focal · ' || co, coalesce(d->>'title', 'New SOS report'), '#dd1d21',
          'An SOS report has been raised by ' || co || ' staff. As the company HSSE Focal, please review it and follow up on site. The HSSE administrators have been alerted too.',
          jsonb_build_array(
            jsonb_build_array('Reference', d->>'refNo'),
            jsonb_build_array('Reported by', case when coalesce((d->>'anonymous')::boolean, false) then 'Anonymous (' || co || ')' else d->>'reporterName' end),
            jsonb_build_array('Station', app.record_name('stations', d->>'stationId')),
            jsonb_build_array('Location', d->>'location'),
            jsonb_build_array('When', app.fmt_time(d->>'occurredAt')),
            jsonb_build_array('What happened', d->>'description'),
            jsonb_build_array('Immediate action', d->>'immediateAction')),
          'Open the report', url || '/hsse/' || p_id, 'HSSE Focal of ' || co || ' (' || names || ')'),
        app.focal_emails(co), 'HSSE Focal of ' || co);
    end if;
  end if;

  -- New corrective actions: loop in the HSSE Focal of the company responsible.
  for a in select * from jsonb_array_elements(coalesce(d->'actions', '[]'::jsonb)) loop
    if o is not null and exists (select 1 from jsonb_array_elements(coalesce(o->'actions', '[]'::jsonb)) x where x->>'id' = a->>'id') then
      continue;
    end if;
    aco := coalesce(nullif(a->>'company', ''), co);
    if coalesce(aco, '') = '' then continue; end if;
    names := app.focal_names(aco);
    if names is null then continue; end if;
    perform app.queue_email('hsse-action:' || p_id || ':' || (a->>'id'), 'SOS_ACTION_FOCAL', 'hsseReports', p_id,
      'Action for ' || aco || ' on SOS report ' || coalesce(d->>'refNo', ''),
      app.email_html('HSSE Focal · action required', 'A corrective action has been assigned to ' || aco, '#b7791f',
        'The HSSE team has assigned an action on an SOS report to ' || aco || '. As the company HSSE Focal, please make sure it is done and mark it complete in Gemsafety.',
        jsonb_build_array(
          jsonb_build_array('Action', a->>'text'),
          jsonb_build_array('Action owner', a->>'owner'),
          jsonb_build_array('Report', concat_ws(' · ', d->>'refNo', d->>'title')),
          jsonb_build_array('Reported by company', co),
          jsonb_build_array('Station', app.record_name('stations', d->>'stationId')),
          jsonb_build_array('Location', d->>'location')),
        'Open the report', url || '/hsse/' || p_id, 'HSSE Focal of ' || aco || ' (' || names || ')'),
      app.focal_emails(aco), 'HSSE Focal of ' || aco);
  end loop;
end $$;

create or replace function app.records_email_trigger() returns trigger
language plpgsql security definer set search_path = app, public as $$
declare o jsonb;
begin
  if new.deleted then return new; end if;
  o := case when tg_op = 'UPDATE' and not old.deleted then old.data else null end;
  begin
    perform app.notify_record(new.collection, new.id, new.data, o);
  exception when others then
    raise warning 'gemsafety email: %', sqlerrm;
  end;
  if new.collection = 'hsseReports' then
    begin
      perform app.notify_focal(new.id, new.data, o);
    exception when others then
      raise warning 'gemsafety focal email: %', sqlerrm;
    end;
  end if;
  return new;
end $$;
