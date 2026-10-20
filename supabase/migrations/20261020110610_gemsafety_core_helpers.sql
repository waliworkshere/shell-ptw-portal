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
    when 'journeys' then 'driverId'
    when 'hsseReports' then 'reporterId'
    else null end
$$;

create or replace function app.hash_token(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

create or replace function app.new_session(p_user_id text) returns text
language plpgsql set search_path = '' as $$
declare v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  delete from app.sessions where expires_at < now();
  insert into app.sessions (token_hash, user_id, expires_at)
  values (app.hash_token(v_token), p_user_id, now() + interval '30 days');
  return v_token;
end $$;

-- Returns the signed-in user's record, or null.
create or replace function app.session_user(p_token text) returns jsonb
language sql stable set search_path = '' as $$
  select r.data
  from app.sessions s
  join app.records r on r.collection = 'users' and r.id = s.user_id and not r.deleted
  where s.token_hash = app.hash_token(p_token) and s.expires_at > now()
$$;

create or replace function app.is_staff(p_role text) returns boolean
language sql immutable set search_path = '' as $$
  select p_role in ('ADMIN', 'APPROVER', 'STATION')
$$;

-- What other people get to see of a user record.
--   full  = everything except password (admin, or the person themself)
--   staff = contact details, no imported personal profile
--   basic = name and role only
create or replace function app.view_user(p_data jsonb, p_level text) returns jsonb
language sql immutable set search_path = '' as $$
  select case p_level
    when 'full' then p_data - 'password'
    when 'staff' then jsonb_strip_nulls(jsonb_build_object(
      'id', p_data->'id', 'fullName', p_data->'fullName', 'role', p_data->'role',
      'email', p_data->'email', 'phone', p_data->'phone', 'company', p_data->'company',
      'jobTitle', p_data->'jobTitle', 'stationId', p_data->'stationId', 'civilId', p_data->'civilId',
      'passportNo', p_data->'passportNo', 'imported', p_data->'imported', 'importedAt', p_data->'importedAt',
      'importSource', p_data->'importSource', 'facePhoto', p_data->'facePhoto', 'faceEnrolledAt', p_data->'faceEnrolledAt',
      'competencyRole', p_data->'competencyRole',
      'username', '', 'password', '', 'civilIdExpiry', ''))
    else jsonb_strip_nulls(jsonb_build_object(
      'id', p_data->'id', 'fullName', p_data->'fullName', 'role', p_data->'role',
      'company', p_data->'company', 'jobTitle', p_data->'jobTitle', 'stationId', p_data->'stationId',
      'phone', case when p_data->>'role' in ('ADMIN','APPROVER','STATION') then p_data->'phone' end,
      'username', '', 'password', '', 'civilId', '', 'civilIdExpiry', '', 'email', ''))
  end
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
    when p_collection in ('applications', 'journeys', 'hsseReports', 'sosAlerts', 'enrollments', 'registrations', 'faceChecks', 'ptwCards')
      then app.is_staff(p_role) or p_owner = p_uid
    else p_owner = p_uid
  end
$$;

-- Keeps reference numbers unique across everyone's devices. If a client
-- proposes a number that is already used, the next free one with the same
-- prefix is assigned instead (e.g. PER-2026-000007).
create or replace function app.unique_number(p_collection text, p_field text, p_id text, p_value text) returns text
language plpgsql set search_path = '' as $$
declare
  v_digits text; v_suffix text; v_prefix text; v_max bigint;
begin
  if p_value is null or p_value = '' then return p_value; end if;
  if not exists (
    select 1 from app.records
    where collection = p_collection and id <> p_id and not deleted and data->>p_field = p_value
  ) then return p_value; end if;
  v_digits := substring(p_value from '(\d+)\D*$');
  if v_digits is null then return p_value || '-' || substr(md5(p_id), 1, 4); end if;
  v_suffix := substring(p_value from '\d+(\D*)$');
  v_prefix := left(p_value, length(p_value) - length(v_digits) - length(v_suffix));
  perform pg_advisory_xact_lock(hashtext(p_collection || ':' || p_field));
  select coalesce(max((substring(data->>p_field from '(\d+)\D*$'))::bigint), 0)
    into v_max
  from app.records
  where collection = p_collection and not deleted
    and left(data->>p_field, length(v_prefix)) = v_prefix
    and substring(data->>p_field from '(\d+)\D*$') is not null;
  return v_prefix || lpad((v_max + 1)::text, length(v_digits), '0') || v_suffix;
end $$;

create or replace function app.number_fields(p_collection text) returns text[]
language sql immutable set search_path = '' as $$
  select case p_collection
    when 'applications' then array['applicationNumber', 'permitNumber']
    when 'hsseReports' then array['refNo']
    when 'sosAlerts' then array['refNo']
    when 'journeys' then array['jmpNumber']
    when 'enrollments' then array['certificateNo']
    when 'payments' then array['receiptNo']
    when 'ptwCards' then array['cardNo']
    else array[]::text[] end
$$;

create or replace function app.user_by_login(p_login text) returns text
language sql stable set search_path = '' as $$
  select coalesce(
    (select user_id from app.credentials where login = lower(trim(p_login))),
    (select id from app.records where collection = 'users' and not deleted and data->>'civilId' = trim(p_login) and trim(p_login) <> '' limit 1),
    (select id from app.records where collection = 'users' and not deleted and lower(data->>'email') = lower(trim(p_login)) and trim(p_login) <> '' limit 1)
  )
$$;

create or replace function app.audit(p_actor text, p_action text, p_description text) returns void
language plpgsql set search_path = '' as $$
declare v_id text := 'a-' || encode(extensions.gen_random_bytes(8), 'hex');
begin
  insert into app.records (collection, id, data, updated_by)
  values ('auditLogs', v_id,
    jsonb_build_object('id', v_id, 'action', p_action, 'actor', p_actor,
      'description', p_description, 'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    'system');
end $$;
