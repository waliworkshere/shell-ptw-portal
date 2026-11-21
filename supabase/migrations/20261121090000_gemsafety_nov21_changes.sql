-- =====================================================================
-- Gemsafety - changes of 21 November 2026
--  * ROM (Regional Operations Manager / station manager) role with the
--    stations they look after (users.stationIds).
--  * Country Lead (users.countryLead) is emailed about every Near Miss /
--    Potential Incident and can read every SOS report.
--  * SOS reports: the reporter no longer rates the RAM. The system suggests
--    it and the HSSE Focal of the reporter's company confirms it.
--  * Start Work Checks must be linked to a work permit or a JMP.
--  * Courses can limit quiz attempts (Permit to Work: 3).
--  * Permit Holders get a confirmation email when they submit; ROMs are
--    emailed about SOS reports at their stations.
-- Existing functions are patched in place; every patch is checked.
-- =====================================================================

create or replace function app.is_staff(p_role text) returns boolean
language sql immutable set search_path = '' as $$
  select p_role in ('ADMIN', 'ARTELIA_MANAGER', 'APPROVER', 'STATION', 'ROM')
$$;

-- Patch helper: replace exactly one known piece of a function's source, or stop.
create or replace function app._patch(p_src text, p_old text, p_new text) returns text
language plpgsql immutable as $$
begin
  if position(p_old in p_src) = 0 then
    raise exception 'gemsafety patch: text not found: %', left(p_old, 120);
  end if;
  return replace(p_src, p_old, p_new);
end $$;

do $$
declare d text;
begin
  -- Users of the ROM role are visible by name like other staff roles.
  d := pg_get_functiondef('app.can_read(text,text,jsonb,text,text)'::regprocedure);
  d := app._patch(d, $x$('ADMIN', 'ARTELIA_MANAGER', 'COMPANY_MANAGER', 'APPROVER', 'STATION')$x$,
                     $x$('ADMIN', 'ARTELIA_MANAGER', 'COMPANY_MANAGER', 'APPROVER', 'STATION', 'ROM')$x$);
  execute d;

  -- Country Lead reads every SOS report.
  d := pg_get_functiondef('public.gs_state(text,timestamptz)'::regprocedure);
  d := app._patch(d, $x$or (r.collection = 'hsseReports' and v_focal_co is not null and app.focal_sees(r.data, v_focal_co))$x$,
                     $x$or (r.collection = 'hsseReports' and v_focal_co is not null and app.focal_sees(r.data, v_focal_co))
         or (r.collection = 'hsseReports' and coalesce((v_me->>'countryLead')::boolean, false))$x$);
  execute d;

  d := pg_get_functiondef('public.gs_sync(text,jsonb)'::regprocedure);
  -- People cannot give themselves stations or the Country Lead flag.
  d := app._patch(d, $x$'hsseFocal','subscription','deactivated'];$x$, $x$'hsseFocal','subscription','deactivated','stationIds','countryLead'];$x$);
  d := app._patch(d, $x$v_price int;$x$, $x$v_price int; v_ramk text[]; v_max int;$x$);
  -- ROMs, like station logins, can comment on permits but not decide them.
  d := app._patch(d, $x$elsif v_role = 'STATION' then$x$, $x$elsif v_role in ('STATION', 'ROM') then$x$);
  -- SOS reports: only staff or the reporter's company HSSE Focal may confirm the RAM.
  d := app._patch(d, $x$          if coalesce(v_me->>'company', '') <> '' then v_d := v_d || jsonb_build_object('reporterCompany', v_me->>'company'); end if;
        elsif not v_staff then
          v_d := v_d - 'reporterCompany';
          if v_old ? 'reporterCompany' then v_d := v_d || jsonb_build_object('reporterCompany', v_old->'reporterCompany'); end if;
        end if;$x$,
    $x$          if coalesce(v_me->>'company', '') <> '' then v_d := v_d || jsonb_build_object('reporterCompany', v_me->>'company'); end if;
          if not v_staff then v_d := v_d - 'ramConfirmed'; end if;
        elsif not v_staff then
          v_d := v_d - 'reporterCompany';
          if v_old ? 'reporterCompany' then v_d := v_d || jsonb_build_object('reporterCompany', v_old->'reporterCompany'); end if;
          if v_focal_co is distinct from (v_old->>'reporterCompany') then
            foreach f in array array['consequence', 'likelihood', 'ramSuggested', 'ramConfirmed'] loop
              v_d := v_d - f;
              if v_old ? f then v_d := v_d || jsonb_build_object(f, v_old->f); end if;
            end loop;
          end if;
        end if;$x$);
  d := app._patch(d, $x$          v_ok := (v_d - 'actions' - 'timeline') = (v_old - 'actions' - 'timeline')$x$,
    $x$          v_ramk := case when v_focal_co = (v_old->>'reporterCompany') then array['consequence', 'likelihood', 'ramConfirmed'] else '{}'::text[] end;
          v_ok := (v_d - 'actions' - 'timeline' - v_ramk) = (v_old - 'actions' - 'timeline' - v_ramk)$x$);
  -- Quiz attempt limits (e.g. Permit to Work: 3 tries).
  d := app._patch(d, $x$    elsif v_c in ('enrollments', 'faceChecks') then
      v_ok := v_new_owner = v_uid and (v_old is null or v_old_owner = v_uid);$x$,
    $x$    elsif v_c in ('enrollments', 'faceChecks') then
      v_ok := v_new_owner = v_uid and (v_old is null or v_old_owner = v_uid);
      if v_ok and v_c = 'enrollments' then
        v_max := null;
        select (c.data->>'maxAttempts')::int into v_max from app.records c
          where c.collection = 'courses' and c.id = v_d->>'courseId' and not c.deleted and coalesce(c.data->>'maxAttempts', '') ~ '^\d+$';
        if v_max is not null then
          for f in select jsonb_object_keys(coalesce(v_d->'lessons', '{}'::jsonb)) loop
            if (v_d->'lessons'->f->>'attempts') is distinct from (v_old->'lessons'->f->>'attempts')
               and (coalesce((v_d->'lessons'->f->>'attempts')::int, 0) > v_max
                    or coalesce((v_d->'lessons'->f->>'attempts')::int, 0) < coalesce((v_old->'lessons'->f->>'attempts')::int, 0)) then
              v_ok := false; v_reason := 'ATTEMPTS'; exit;
            end if;
          end loop;
        end if;
      end if;$x$);
  -- A Start Work Check must name the permit or JMP it is done under.
  d := app._patch(d, $x$    elsif v_c = 'workChecks' then
      v_ok := v_new_owner = v_uid and (v_old is null or v_old_owner = v_uid);$x$,
    $x$    elsif v_c = 'workChecks' then
      v_ok := v_new_owner = v_uid and (v_old is null or v_old_owner = v_uid);
      if v_ok and v_old is null and v_d->>'kind' = 'SWC' and coalesce(nullif(v_d->>'applicationId', ''), nullif(v_d->>'journeyId', '')) is null then
        v_ok := false; v_reason := 'LINK';
      end if;$x$);
  execute d;

  -- Emails: label the reporter's RAM as a suggestion, and name the two new focal forms.
  d := pg_get_functiondef('app.notify_record(text,text,jsonb,jsonb)'::regprocedure);
  d := app._patch(d, $x$jsonb_build_array('Severity', concat_ws$x$, $x$jsonb_build_array('Severity (system suggestion)', concat_ws$x$);
  d := app._patch(d, $x$when 'PTW_AUDIT' then 'PTW audit' else$x$, $x$when 'PTW_AUDIT' then 'PTW audit' when 'ASSET_SURVEY' then 'asset condition survey' when 'SAFETY_CULTURE' then 'safety culture survey' else$x$);
  execute d;
end $$;

drop function app._patch(text, text, text);

-- Checks a permit / JMP number for a Start Work Check done under someone else's permit or journey plan.
create or replace function public.gs_lookup_work_ref(p_token text, p_kind text, p_ref text) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare v_me jsonb := app.session_user(p_token); v_r jsonb; v_n text := upper(trim(coalesce(p_ref, '')));
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  if v_n = '' then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if p_kind = 'JMP' then
    select data into v_r from app.records where collection = 'journeys' and not deleted and upper(data->>'jmpNumber') = v_n limit 1;
    if v_r is null then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
    if v_r->>'status' not in ('APPROVED', 'IN_PROGRESS') then return jsonb_build_object('ok', false, 'error', 'NOT_ACTIVE', 'status', v_r->>'status'); end if;
    return jsonb_build_object('ok', true, 'id', v_r->>'id', 'number', v_r->>'jmpNumber', 'stationId', v_r->>'destinationStationId', 'status', v_r->>'status');
  end if;
  select data into v_r from app.records where collection = 'applications' and not deleted
    and (upper(data->>'permitNumber') = v_n or upper(data->>'applicationNumber') = v_n) limit 1;
  if v_r is null then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if v_r->>'status' <> 'APPROVED' then return jsonb_build_object('ok', false, 'error', 'NOT_ACTIVE', 'status', v_r->>'status'); end if;
  return jsonb_build_object('ok', true, 'id', v_r->>'id', 'number', coalesce(v_r->>'permitNumber', v_r->>'applicationNumber'), 'stationId', v_r->>'stationId', 'status', v_r->>'status');
end $$;
revoke all on function public.gs_lookup_work_ref(text, text, text) from public;
grant execute on function public.gs_lookup_work_ref(text, text, text) to anon, authenticated;

-- Extra emails: Country Lead, ROMs, and the Permit Holder's submission receipt.
create or replace function app.notify_more(p_collection text, p_id text, d jsonb, o jsonb) returns void
language plpgsql security definer set search_path = app, public as $$
declare
  url text := app.email_setting('app_url') #>> '{}';
  leads text[];
  roms text[];
  types text;
  station text;
  holder text;
  st text := d->>'status';
begin
  if p_collection = 'hsseReports' and o is null then
    select string_agg(case t when 'NEAR_MISS' then 'Near Miss' when 'POTENTIAL_INCIDENT' then 'Potential Incident'
      when 'UNSAFE_ACT' then 'Unsafe Act' when 'UNSAFE_CONDITION' then 'Unsafe Condition' else t end, ', ')
      into types from jsonb_array_elements_text(coalesce(nullif(d->'types', '[]'::jsonb), jsonb_build_array(d->>'type'))) t;
    station := app.record_name('stations', d->>'stationId');

    if coalesce(d->'types', jsonb_build_array(d->>'type')) ?| array['NEAR_MISS', 'POTENTIAL_INCIDENT'] then
      select coalesce(array_agg(data->>'email'), '{}') into leads from app.records
        where collection = 'users' and not deleted and coalesce((data->>'countryLead')::boolean, false) and coalesce(data->>'email', '') like '%@%';
      if cardinality(leads) > 0 then
        perform app.queue_email('hsse-lead:' || p_id, 'SOS_COUNTRY_LEAD', p_collection, p_id,
          case when coalesce(d->'types', '[]'::jsonb) ? 'POTENTIAL_INCIDENT' then 'Potential Incident' else 'Near Miss' end
            || ' reported: ' || coalesce(d->>'refNo', '') || ' ' || coalesce(d->>'title', ''),
          app.email_html('Country Lead alert', coalesce(d->>'title', 'New report'), '#dd1d21',
            'A ' || lower(case when coalesce(d->'types', '[]'::jsonb) ? 'POTENTIAL_INCIDENT' then 'Potential Incident' else 'Near Miss' end)
              || ' has just been reported in Gemsafety. The company HSSE Focal will confirm the severity on the RAM.',
            jsonb_build_array(
              jsonb_build_array('Reference', d->>'refNo'),
              jsonb_build_array('Type', types),
              jsonb_build_array('Suggested RAM', (d->>'consequence') || (d->>'likelihood')),
              jsonb_build_array('Company', d->>'reporterCompany'),
              jsonb_build_array('Reported by', case when coalesce((d->>'anonymous')::boolean, false) then 'Anonymous' else d->>'reporterName' end),
              jsonb_build_array('Station', station),
              jsonb_build_array('Location', d->>'location'),
              jsonb_build_array('When', app.fmt_time(d->>'occurredAt')),
              jsonb_build_array('What happened', d->>'description'),
              jsonb_build_array('Life-Saving Rule', d->>'lifeSavingRule')),
            'Open the report', url || '/hsse/' || p_id, 'Country Lead'),
          leads, 'Country Lead');
      end if;
    end if;

    if coalesce(d->>'stationId', '') <> '' then
      select coalesce(array_agg(data->>'email'), '{}') into roms from app.records
        where collection = 'users' and not deleted and data->>'role' = 'ROM' and coalesce(data->'stationIds', '[]'::jsonb) ? (d->>'stationId')
          and coalesce(data->>'email', '') like '%@%';
      if cardinality(roms) > 0 then
        perform app.queue_email('hsse-rom:' || p_id, 'SOS_REPORT_ROM', p_collection, p_id,
          'SOS report at ' || coalesce(station, 'your station') || ': ' || coalesce(d->>'refNo', '') || ' ' || coalesce(d->>'title', ''),
          app.email_html('Your station · ' || coalesce(station, ''), coalesce(d->>'title', 'New SOS report'), '#0f2a47',
            'An SOS report has been raised at a station you manage.',
            jsonb_build_array(
              jsonb_build_array('Reference', d->>'refNo'),
              jsonb_build_array('Type', types),
              jsonb_build_array('Location', d->>'location'),
              jsonb_build_array('When', app.fmt_time(d->>'occurredAt')),
              jsonb_build_array('What happened', d->>'description'),
              jsonb_build_array('Immediate action', d->>'immediateAction')),
            'Open the report', url || '/hsse/' || p_id, 'ROM of ' || coalesce(station, 'the station')),
          roms, 'ROM of ' || coalesce(station, 'the station'));
      end if;
    end if;
  end if;

  -- Permit Holder's own copy when they submit or resubmit a permit request.
  if p_collection = 'applications' and st is distinct from (o->>'status') and st in ('SUBMITTED', 'RESUBMITTED') then
    holder := app.record_name('users', d->>'applicantId', 'email');
    if coalesce(holder, '') like '%@%' then
      station := app.record_name('stations', d->>'stationId');
      perform app.queue_email('ptw-holder:' || p_id || ':' || st || ':' || coalesce(d->>'updatedAt', ''), 'PERMIT_RECEIPT', p_collection, p_id,
        'We received your permit request ' || coalesce(d->>'applicationNumber', ''),
        app.email_html('Permit to Work', 'Your permit request has been ' || case st when 'RESUBMITTED' then 'resubmitted' else 'submitted' end, '#0f2a47',
          'Your request is with the permit reviewers. You will get another email when it is approved, rejected or needs changes.',
          jsonb_build_array(
            jsonb_build_array('Request', d->>'applicationNumber'),
            jsonb_build_array('Permit type', app.record_name('permitTypes', d->>'permitTypeId')),
            jsonb_build_array('Risk level', initcap(d->>'riskLevel')),
            jsonb_build_array('Station', station),
            jsonb_build_array('Submitted', app.fmt_time(coalesce(d->>'submittedAt', d->>'updatedAt')))),
          'Open my request', url || '/applicant/applications/' || p_id, coalesce(d->>'applicantName', 'the Permit Holder')),
        array[holder], coalesce(d->>'applicantName', 'the Permit Holder'));
    end if;
  end if;
end $$;
revoke all on function app.notify_more(text, text, jsonb, jsonb) from public;

create or replace function app.records_email_trigger3() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  if new.deleted then return new; end if;
  begin
    perform app.notify_more(new.collection, new.id, new.data, case when tg_op = 'UPDATE' and not old.deleted then old.data else null end);
  exception when others then
    raise warning 'gemsafety email (more): %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists records_email_more on app.records;
create trigger records_email_more
  after insert or update on app.records
  for each row
  when (new.collection in ('hsseReports', 'applications'))
  execute function app.records_email_trigger3();

-- Permit to Work course: 3 quiz attempts at most.
update app.records set data = data || '{"maxAttempts": 3}'::jsonb, updated_at = clock_timestamp()
  where collection = 'courses' and id = 'crs-ptw201' and not deleted;

-- NOTE: emails still go only to the override list in app.email_settings ('override_to').
-- Switching to real recipients is a separate, deliberate step:
--   update app.email_settings set value = '[]'::jsonb where key = 'override_to';
