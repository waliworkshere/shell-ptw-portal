-- Member import (existing Gem member register) + competency role guess.
-- Idempotent.

-- Best guess of a member's competency-matrix group from their job title.
-- Admins can change it later on the Competency matrix page.
create or replace function app.guess_competency(p_title text) returns text
language sql immutable set search_path = '' as $$
  select case
    when t is null or t = '' then null
    when t ~ '(manager|engineer|supervisor|hse|hsse|safety|officer|director|coordinator|co-ordinator|in.?charge|\mpm\M|\mcm\M|\mrom\M|consultant|inspector)' then 'SUPERVISOR_MANAGER'
    when t ~ '(electric|technic|technican|mep|mechanic|\mac\M|hvac|instrument|fuel|\mcei\M|plumb)' then 'MEP_CEI'
    when t ~ '(driver|operator|foreman|charge ?hand|rigger)' then 'DRIVER_OPERATOR'
    when t ~ '(mason|mation|painter|fitter|carpenter|welder|fabricat|erector|tile|steel|scaffold|plaster|gypsum|block)' then 'SKILLED_TRADES'
    when t ~ '(helper|halper|labou?r|worker|assistant|cleaner|porter|watchman)' then 'HELPER'
    else null end
  from (select lower(trim(p_title)) as t) x
$$;

create or replace function app.title_case(p text) returns text
language sql immutable set search_path = '' as $$
  select case when p is null then null else
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
      initcap(regexp_replace(trim(p), '\s+', ' ', 'g')),
      '\mLlc\M', 'LLC', 'g'), '\mL\.L\.C\.?', 'LLC', 'g'), '\mSpc\M', 'SPC', 'g'), '\mSaog\M', 'SAOG', 'g'), '\mWll\M', 'WLL', 'g') end
$$;

create or replace function app.blood_group(p text) returns text
language sql immutable set search_path = '' as $$
  select case when w !~ '[c-np-z]' and g ~ '^(a|b|ab|o)[+-]?$' then upper(g) else null end
  from (select w, regexp_replace(w, '[^abo+-]', '', 'g') as g
        from (select regexp_replace(regexp_replace(regexp_replace(regexp_replace(
            lower(coalesce(p, '')), '0', 'o', 'g'),
            '\mn\w*g\w*|-\s*ve\M|\mve\s*-', '-', 'g'),
            '\mp\w*s\w*|\+\s*ve\M|\mve\s*\+', '+', 'g'),
            've|ev', '', 'g') as w) x) y
$$;

-- Rows are compact arrays (keeps the payload small):
-- [0 memberId, 1 name, 2 email, 3 dob, 4 civilId, 5 designation, 6 company,
--  7 nationality, 8 bloodGroup, 9 examResult, 10 examScore, 11 hasCertificate,
--  12 submittedAt, 13 certs [[code, number, issued, expires], ...]]
create or replace function app.import_members(p_rows jsonb, p_source text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  r jsonb; v_id text; v_mid text; v_user jsonb; v_old jsonb; v_company text; v_created int := 0; v_updated int := 0; v_companies int := 0;
  v_now text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_certs jsonb; v_civil text;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    v_mid := upper(regexp_replace(coalesce(r->>0, ''), '[^A-Za-z0-9]', '', 'g'));
    if v_mid = '' or coalesce(trim(r->>1), '') = '' then continue; end if;
    v_id := 'm-' || lower(v_mid);
    v_civil := coalesce(nullif(regexp_replace(coalesce(r->>4, ''), '\s', '', 'g'), ''), v_mid);
    v_company := nullif(trim(coalesce(r->>6, '')), '');

    if v_company is not null and not exists (
      select 1 from app.records where collection = 'companies' and not deleted and lower(data->>'name') = lower(v_company)) then
      insert into app.records (collection, id, data, updated_by) values ('companies', 'co-' || substr(md5(lower(v_company)), 1, 12),
        jsonb_build_object('id', 'co-' || substr(md5(lower(v_company)), 1, 12), 'name', v_company, 'crNumber', '',
          'category', 'Contractor (imported)', 'status', 'APPROVED', 'addedAt', v_now), 'import')
        on conflict (collection, id) do nothing;
      v_companies := v_companies + 1;
    end if;

    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'code', c->>0, 'number', nullif(c->>1, ''), 'issued', nullif(c->>2, ''), 'expires', nullif(c->>3, '')))), '[]'::jsonb)
      into v_certs
    from jsonb_array_elements(coalesce(r->13, '[]'::jsonb)) c;

    select data into v_old from app.records where collection = 'users' and id = v_id;

    v_user := jsonb_strip_nulls(jsonb_build_object(
      'id', v_id,
      'fullName', app.title_case(r->>1),
      'email', case when trim(coalesce(r->>2, '')) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then lower(trim(r->>2)) else '' end,
      'role', coalesce(v_old->>'role', 'TRAINEE'),
      'username', coalesce(v_old->>'username', ''),
      'password', '',
      'civilId', v_civil,
      'civilIdExpiry', coalesce(v_old->>'civilIdExpiry', ''),
      'company', v_company,
      'jobTitle', app.title_case(r->>5),
      'phone', v_old->>'phone',
      'stationId', v_old->>'stationId',
      'facePhoto', v_old->>'facePhoto',
      'faceEnrolledAt', v_old->>'faceEnrolledAt',
      'imported', true,
      'importedAt', coalesce(v_old->>'importedAt', v_now),
      'importSource', p_source,
      'passportNo', 'SP-OM-' || v_mid,
      'competencyRole', coalesce(v_old->>'competencyRole', app.guess_competency(r->>5)),
      'member', jsonb_strip_nulls(jsonb_build_object(
        'memberId', v_mid,
        'dob', nullif(r->>3, ''),
        'nationality', app.title_case(nullif(r->>7, '')),
        'bloodGroup', app.blood_group(r->>8),
        'examResult', initcap(nullif(r->>9, '')),
        'examScore', case when coalesce(r->>10, '') ~ '^\d+(\.\d+)?$' then (r->>10)::numeric end,
        'certificateUrl', case when coalesce((r->>11)::boolean, false) then 'https://gemtrained.com/members_track/certificates/' || v_mid || '.pdf' end,
        'qrUrl', 'https://gemtrained.com/members_track/qrcodes/' || v_mid || '.png',
        'submittedAt', nullif(r->>12, ''),
        'certs', v_certs))));

    insert into app.records (collection, id, data, owner_id, updated_by)
      values ('users', v_id, v_user, v_id, 'import')
      on conflict (collection, id) do update set data = excluded.data, deleted = false, updated_at = clock_timestamp(), updated_by = 'import';
    if v_old is null then v_created := v_created + 1; else v_updated := v_updated + 1; end if;
  end loop;
  return jsonb_build_object('created', v_created, 'updated', v_updated, 'companies', v_companies);
end $$;

create or replace function public.gs_import_members(p_token text, p_rows jsonb, p_source text default 'Member register import') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_me jsonb := app.session_user(p_token); v_res jsonb;
begin
  if v_me is null or v_me->>'role' <> 'ADMIN' then return jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); end if;
  v_res := app.import_members(p_rows, p_source);
  perform app.audit(v_me->>'fullName', 'MEMBERS_IMPORTED',
    format('%s new and %s updated members imported (%s)', v_res->>'created', v_res->>'updated', p_source));
  return v_res || jsonb_build_object('ok', true);
end $$;
