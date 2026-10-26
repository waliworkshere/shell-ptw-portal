
-- =====================================================================
-- Gemsafety - set of changes of 25 October 2026:
--  * New tiers: Artelia Manager (all permits incl. High risk) and
--    Company Manager & HSSE (own company, Low / Medium risk). HSSE Focals
--    get the same company approval rights.
--  * Annual subscription (40 USD) unlocks Permit to Work and Journey
--    Management for Permit Holders / workers; paid courses need a confirmed
--    order (Category 1 = 25 USD, Category 2 = 40 USD).
--  * Only Safety Passport holders: deactivated accounts cannot sign in and
--    open self-registration is closed.
--  * Points last one calendar quarter.
--  * Video calls only in working hours (08:00-17:00, Sun-Thu, Oman time).
--  * Holders can close approved permits; Start Work Checks and LMRAs.
-- =====================================================================

create or replace function app.is_staff(p_role text) returns boolean
language sql immutable set search_path = '' as $$
  select p_role in ('ADMIN', 'ARTELIA_MANAGER', 'APPROVER', 'STATION')
$$;

/** Company whose Low / Medium risk permits (and SOS reports) this person handles: a Company Manager, or an appointed HSSE Focal. */
create or replace function app.approver_company(p_me jsonb) returns text
language sql immutable set search_path = '' as $$
  select case
    when coalesce((p_me->'hsseFocal'->>'active')::boolean, false) and coalesce(p_me->'hsseFocal'->>'company', '') <> '' then p_me->'hsseFocal'->>'company'
    when p_me->>'role' = 'COMPANY_MANAGER' and coalesce(p_me->>'company', '') <> '' then p_me->>'company'
    else null end
$$;

create or replace function app.quarter_key(p_at timestamptz) returns text
language sql immutable set search_path = '' as $$
  select to_char(p_at at time zone 'Asia/Muscat', 'YYYY') || '-Q' || to_char(p_at at time zone 'Asia/Muscat', 'Q')
$$;

create or replace function app.working_hours(p_at timestamptz) returns boolean
language sql immutable set search_path = '' as $$
  select extract(dow from p_at at time zone 'Asia/Muscat') between 0 and 4
     and (p_at at time zone 'Asia/Muscat')::time >= time '08:00' and (p_at at time zone 'Asia/Muscat')::time < time '17:00'
$$;

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
    when 'focalReports' then 'userId'
    when 'orders' then 'userId'
    when 'workChecks' then 'userId'
    when 'journeys' then 'driverId'
    when 'hsseReports' then 'reporterId'
    else null end
$$;

create or replace function app.can_read(p_collection text, p_owner text, p_data jsonb, p_uid text, p_role text) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when p_role = 'ADMIN' then true
    when p_collection in ('stations', 'permitTypes', 'courses', 'companies') then true
    when p_collection = 'users' then app.is_staff(p_role) or p_owner = p_uid or (p_data->>'role') in ('ADMIN', 'ARTELIA_MANAGER', 'COMPANY_MANAGER', 'APPROVER', 'STATION')
    when p_collection = 'auditLogs' then false
    when p_collection = 'payments' then p_owner = p_uid
    when p_collection = 'screenshotGallery' then app.is_staff(p_role)
    when p_collection in ('applications', 'journeys', 'hsseReports', 'sosAlerts', 'enrollments', 'registrations', 'faceChecks', 'ptwCards', 'certUploads', 'focalReports', 'workChecks')
      then app.is_staff(p_role) or p_owner = p_uid
    else p_owner = p_uid
  end
$$;

-- Deactivated accounts have no valid session.
create or replace function app.session_user(p_token text) returns jsonb
language sql stable set search_path = '' as $$
  select r.data
  from app.sessions s
  join app.records r on r.collection = 'users' and r.id = s.user_id and not r.deleted
  where s.token_hash = app.hash_token(p_token) and s.expires_at > now() and not (r.data ? 'deactivated')
$$;

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
  if exists (select 1 from app.records where collection = 'users' and id = v_uid and data ? 'deactivated') then
    return jsonb_build_object('ok', false, 'error', 'DEACTIVATED');
  end if;
  update app.credentials set failed_attempts = 0, locked_until = null, updated_at = now() where user_id = v_uid;
  return jsonb_build_object('ok', true, 'token', app.new_session(v_uid), 'mustChange', v_cred.must_change);
end $$;

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
  if v_user.data ? 'deactivated' then
    return jsonb_build_object('ok', false, 'error', 'DEACTIVATED');
  end if;
  update app.activation_attempts set failures = 0, locked_until = null where civil_id = trim(p_civil_id);
  insert into app.credentials (user_id, login, password_hash)
    values (v_user.id, lower(trim(p_civil_id)), extensions.crypt(p_password, extensions.gen_salt('bf', 10)));
  update app.records set data = data || jsonb_build_object('username', trim(p_civil_id)), updated_at = clock_timestamp()
    where collection = 'users' and id = v_user.id;
  perform app.audit(v_user.data->>'fullName', 'ACCOUNT_ACTIVATED', (v_user.data->>'fullName') || ' activated their imported account');
  return jsonb_build_object('ok', true, 'token', app.new_session(v_user.id), 'mustChange', false);
end $$;

-- Open self-registration is closed: only Safety Passport holders (on the register) use Gemsafety.
create or replace function public.gs_register(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return jsonb_build_object('ok', false, 'error', 'PASSPORT_REQUIRED');
end $$;

-- Who may join the video verification call: reviewers of the permit and the applicant.
create or replace function public.gs_call_access(p_token text, p_application_id text) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare v_me jsonb := app.session_user(p_token); v_owner text; v_role text; v_app jsonb; v_reviewer boolean; v_co text;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  select owner_id, data into v_owner, v_app from app.records where collection = 'applications' and id = p_application_id and not deleted;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  v_role := v_me->>'role';
  v_co := app.approver_company(v_me);
  v_reviewer := v_owner is distinct from (v_me->>'id') and (v_role in ('ADMIN', 'ARTELIA_MANAGER', 'APPROVER')
    or (v_co is not null and v_app->>'applicantCompany' = v_co and v_app->>'riskLevel' in ('LOW', 'MEDIUM')));
  if v_reviewer or v_owner = v_me->>'id' then
    return jsonb_build_object('ok', true, 'userId', v_me->>'id', 'name', v_me->>'fullName', 'staff', v_reviewer);
  end if;
  return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
end $$;

create or replace function public.gs_state(p_token text, p_since timestamptz default null) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare v_me jsonb := app.session_user(p_token); v_uid text; v_role text; v_records jsonb; v_cred app.credentials; v_focal_co text; v_co text;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  v_uid := v_me->>'id'; v_role := v_me->>'role';
  v_focal_co := app.approver_company(v_me);
  v_co := nullif(v_me->>'company', '');
  select coalesce(jsonb_agg(jsonb_build_object(
      'c', r.collection, 'id', r.id, 'x', r.deleted,
      'd', case when r.deleted then null
                when r.collection = 'users' then app.view_user(r.data,
                  case when v_role = 'ADMIN' or r.id = v_uid then 'full'
                       when app.is_staff(v_role) or (v_focal_co is not null and r.data->>'company' = v_focal_co) then 'staff' else 'basic' end)
                else r.data end)), '[]'::jsonb)
    into v_records
  from app.records r
  where (p_since is null or r.updated_at > p_since)
    and (r.deleted or app.can_read(r.collection, r.owner_id, r.data, v_uid, v_role)
         or (r.collection = 'hsseReports' and v_focal_co is not null and app.focal_sees(r.data, v_focal_co))
         -- Company Managers & HSSE Focals: their company's Low / Medium risk permits, people and work checks
         or (v_focal_co is not null and r.collection = 'applications' and r.data->>'applicantCompany' = v_focal_co
             and r.data->>'riskLevel' in ('LOW', 'MEDIUM') and r.data->>'status' <> 'DRAFT')
         or (v_focal_co is not null and r.collection = 'users' and r.data->>'company' = v_focal_co)
         or (v_focal_co is not null and r.collection = 'workChecks' and r.data->>'company' = v_focal_co))
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
  v_protected text[] := array['role','username','civilId','civilIdExpiry','stationId','imported','importedAt','importSource','passportNo','member','competencyRole','hsseFocal','subscription','deactivated'];
  v_points text[] := array['points','pointsStatus','pointsDecidedAt','pointsDecidedBy','pointsNote'];
  v_earned int; v_spent int;
  v_focal_co text; v_a jsonb; v_b jsonb; v_sub boolean; v_q text; v_price int;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  v_uid := v_me->>'id'; v_role := v_me->>'role'; v_staff := app.is_staff(v_role); v_admin := v_role = 'ADMIN';
  v_focal_co := app.approver_company(v_me);
  v_sub := v_role not in ('APPLICANT', 'TRAINEE')
    or (coalesce(v_me->'subscription'->>'startsAt', '9999') <= to_char(now() at time zone 'Asia/Muscat', 'YYYY-MM-DD')
        and coalesce(v_me->'subscription'->>'expiresAt', '0000') >= to_char(now() at time zone 'Asia/Muscat', 'YYYY-MM-DD'));
  v_q := app.quarter_key(now());

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
                      'certUploads','redemptions','focalReports','orders','workChecks');
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
        if v_ok and not v_sub then v_ok := false; v_reason := 'SUBSCRIPTION'; end if;
        -- The Permit Holder's company is stamped by the server (its Company Manager / HSSE Focal reviews Low and Medium risk).
        v_d := v_d - 'applicantCompany';
        if coalesce(v_me->>'company', '') <> '' then v_d := v_d || jsonb_build_object('applicantCompany', v_me->>'company'); end if;
      else
        v_d := v_d - 'applicantCompany';
        if v_old ? 'applicantCompany' then v_d := v_d || jsonb_build_object('applicantCompany', v_old->'applicantCompany'); end if;
        if v_role in ('ARTELIA_MANAGER', 'APPROVER') then
          v_ok := true;
        elsif v_role = 'STATION' then
          -- Station staff can comment, not decide.
          v_ok := (v_d->>'status') is not distinct from (v_old->>'status');
          if not v_ok then v_reason := 'STATUS'; end if;
        elsif v_old_owner = v_uid and v_new_owner = v_uid then
          v_ok := true;
          if (v_d->>'status') is distinct from (v_old->>'status')
             and ((v_d->>'status') not in ('DRAFT', 'SUBMITTED', 'RESUBMITTED', 'CANCELLED', 'CLOSED')
                  or ((v_d->>'status') = 'CLOSED' and (v_old->>'status') <> 'APPROVED')) then v_ok := false; v_reason := 'STATUS'; end if;
          if (v_d->>'permitNumber') is distinct from (v_old->>'permitNumber') then v_ok := false; v_reason := 'STATUS'; end if;
          if (v_d->>'expiresAt') is distinct from (v_old->>'expiresAt') then v_ok := false; v_reason := 'STATUS'; end if;
        elsif v_focal_co is not null and (v_old->>'applicantCompany') = v_focal_co
              and (v_old->>'riskLevel') in ('LOW', 'MEDIUM') and (v_d->>'riskLevel') = (v_old->>'riskLevel')
              and v_new_owner = v_old_owner then
          -- Company Manager & HSSE / HSSE Focal: Low and Medium risk permits of their own company.
          v_ok := true;
        end if;
      end if;
      if v_old is null and not v_staff and (v_d->>'status') not in ('DRAFT', 'SUBMITTED') then v_ok := false; v_reason := 'STATUS'; end if;
      -- Calls can be started only in working hours (08:00-17:00, Sunday-Thursday, Oman time).
      if v_ok and (v_d->>'callStatus') in ('RINGING', 'IN_PROGRESS') and (v_d->>'callStatus') is distinct from (v_old->>'callStatus')
         and not app.working_hours(now()) then
        v_ok := false; v_reason := 'HOURS';
      end if;
    elsif v_c = 'journeys' then
      if v_old is null then
        v_ok := v_new_owner = v_uid and (v_d->>'status') in ('DRAFT', 'SUBMITTED');
        if v_ok and not v_sub then v_ok := false; v_reason := 'SUBSCRIPTION'; end if;
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
        -- Points last one calendar quarter; unused points do not roll over.
        select coalesce(sum(case when (data->>'points') ~ '^\d+$' then (data->>'points')::int else 0 end), 0) into v_earned
          from app.records where collection = 'hsseReports' and not deleted and owner_id = v_uid and data->>'pointsStatus' = 'APPROVED'
            and app.quarter_key(coalesce(nullif(data->>'pointsDecidedAt', ''), nullif(data->>'createdAt', ''), updated_at::text)::timestamptz) = v_q;
        select coalesce(sum(case when (data->>'cost') ~ '^\d+$' then (data->>'cost')::int else 0 end), 0) into v_spent
          from app.records where collection = 'redemptions' and not deleted and owner_id = v_uid and data->>'status' in ('PENDING', 'FULFILLED')
            and app.quarter_key((data->>'requestedAt')::timestamptz) = v_q;
        v_d := v_d || jsonb_build_object('requestedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
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
      -- Paid courses (Category 1 / 2) need a confirmed payment before enrolment.
      if v_ok and v_c = 'enrollments' and v_old is null
         and exists (select 1 from app.records c where c.collection = 'courses' and c.id = v_d->>'courseId' and not c.deleted and c.data->>'tier' in ('CAT1', 'CAT2'))
         and not exists (select 1 from app.records o where o.collection = 'orders' and not o.deleted and o.owner_id = v_uid
                         and o.data->>'kind' = 'COURSE' and o.data->>'courseId' = v_d->>'courseId' and o.data->>'status' = 'PAID') then
        v_ok := false; v_reason := 'PAYMENT';
      end if;
    elsif v_c = 'orders' then
      -- People request a purchase; an Administrator confirms payment.
      v_price := case when v_d->>'kind' = 'SUBSCRIPTION' then 40
        else (select case c.data->>'tier' when 'CAT1' then 25 when 'CAT2' then 40 else 0 end from app.records c
              where c.collection = 'courses' and c.id = v_d->>'courseId' and not c.deleted) end;
      if v_old is null then
        v_ok := v_new_owner = v_uid and (v_d->>'status') = 'PENDING' and coalesce(v_price, 0) > 0
          and (v_d->>'amountUsd') ~ '^\d+(\.\d+)?$' and (v_d->>'amountUsd')::numeric = v_price;
      else
        v_ok := v_old_owner = v_uid and v_new_owner = v_uid and (v_old->>'status') = 'PENDING' and (v_d->>'status') = 'CANCELLED'
          and (v_d - 'status' - 'note') = (v_old - 'status' - 'note');
      end if;
    elsif v_c = 'workChecks' then
      v_ok := v_new_owner = v_uid and (v_old is null or v_old_owner = v_uid);
      v_d := v_d - 'company';
      if coalesce(v_me->>'company', '') <> '' then v_d := v_d || jsonb_build_object('company', v_me->>'company'); end if;
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

-- Emails for purchases waiting for payment and booked video calls.
create or replace function app.notify_extra(p_collection text, p_id text, d jsonb, o jsonb) returns void
language plpgsql security definer set search_path = app, public as $$
declare
  url text := app.email_setting('app_url') #>> '{}';
  admins text[];
  holder text;
  station text;
begin
  select coalesce(array_agg(data->>'email'), '{}') into admins from app.records
    where collection = 'users' and not deleted and data->>'role' = 'ADMIN' and coalesce(data->>'email', '') like '%@%';
  if p_collection = 'orders' and o is null and d->>'status' = 'PENDING' then
    perform app.queue_email('order:' || p_id, 'ORDER_REQUESTED', p_collection, p_id,
      'Payment to confirm: ' || coalesce(d->>'label', '') || ' — ' || coalesce(d->>'userName', ''),
      app.email_html('Payments', 'New purchase waiting for payment', '#b7791f',
        coalesce(d->>'userName', 'A member') || ' wants to buy ' || coalesce(d->>'label', 'an item') || '. Confirm it in Payments & subscriptions once the money is received.',
        jsonb_build_array(
          jsonb_build_array('Member', d->>'userName'),
          jsonb_build_array('Company', d->>'company'),
          jsonb_build_array('Item', d->>'label'),
          jsonb_build_array('Amount', (d->>'amountUsd') || ' USD'),
          jsonb_build_array('Reference', upper(right(p_id, 8))),
          jsonb_build_array('Requested', app.fmt_time(d->>'requestedAt'))),
        'Open Payments & subscriptions', url || '/admin/payments', 'Administrators'),
      admins, 'Administrators');
  end if;
  if p_collection = 'applications' and d->'scheduledCall' is not null and jsonb_typeof(d->'scheduledCall') = 'object'
     and (o is null or (o->'scheduledCall') is distinct from (d->'scheduledCall')) then
    holder := app.record_name('users', d->>'applicantId', 'email');
    station := app.record_name('stations', d->>'stationId');
    perform app.queue_email('call:' || p_id || ':' || (d->'scheduledCall'->>'at'), 'CALL_SCHEDULED', p_collection, p_id,
      'Video call booked: ' || coalesce(d->>'applicationNumber', '') || ' — ' || to_char((d->'scheduledCall'->>'at')::timestamptz at time zone 'Asia/Muscat', 'Dy DD Mon, HH24:MI'),
      app.email_html('Permit to Work', 'Video verification call booked', '#0f2a47',
        coalesce(d->'scheduledCall'->>'by', 'Someone') || ' booked the video verification call for this permit request.',
        jsonb_build_array(
          jsonb_build_array('Request', d->>'applicationNumber'),
          jsonb_build_array('When', app.fmt_time(d->'scheduledCall'->>'at')),
          jsonb_build_array('Permit Holder', d->>'applicantName'),
          jsonb_build_array('Station', station),
          jsonb_build_array('Note', d->'scheduledCall'->>'note')),
        'Open the request', url || '/applicant/applications/' || p_id, 'The Permit Holder and the permit reviewers'),
      array[holder], 'Permit Holder and reviewers');
  end if;
end $$;

create or replace function app.records_email_trigger2() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  if new.deleted then return new; end if;
  begin
    perform app.notify_extra(new.collection, new.id, new.data, case when tg_op = 'UPDATE' and not old.deleted then old.data else null end);
  exception when others then
    raise warning 'gemsafety email (extra): %', sqlerrm;
  end;
  return new;
end $$;

create trigger records_email_extra
  after insert or update on app.records
  for each row
  when (new.collection in ('orders', 'applications'))
  execute function app.records_email_trigger2();
