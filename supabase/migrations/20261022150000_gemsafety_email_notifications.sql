-- =====================================================================
-- Gemsafety: automated email notifications through Resend.
-- A trigger on app.records spots events (SOS alerts, SOS reports, permit
-- steps, certificate checks, reward requests, registrations, focal reports),
-- renders a branded email and queues it with pg_net, so saving data is
-- never slowed down or blocked by email.
-- The Resend API key lives in Vault as 'resend_api_key'.
-- =====================================================================

create extension if not exists pg_net;

create table if not exists app.email_settings (
  key text primary key,
  value jsonb not null
);

insert into app.email_settings (key, value) values
  ('enabled', 'true'::jsonb),
  ('from', '"Gemsafety <noreply@gemsafetypro.com>"'::jsonb),
  -- While this list is not empty, every email goes only to these addresses.
  ('override_to', '["kingsly100@gmail.com"]'::jsonb),
  ('app_url', '"https://gemsafetypro.com"'::jsonb)
on conflict (key) do nothing;

create table if not exists app.email_log (
  id bigserial primary key,
  dedupe_key text not null unique,
  event text not null,
  collection text not null,
  record_id text not null,
  to_addresses text[] not null,
  intended_for text,
  subject text not null,
  request_id bigint,
  error text,
  created_at timestamptz not null default now()
);

alter table app.email_settings enable row level security;
alter table app.email_log enable row level security;

create or replace function app.email_setting(p_key text) returns jsonb
language sql stable security definer set search_path = app, public as $$
  select value from app.email_settings where key = p_key
$$;

create or replace function app.h(p text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

create or replace function app.fmt_time(p text) returns text
language sql stable as $$
  select case when p is null or p = '' then '—'
    else to_char((p::timestamptz) at time zone 'Asia/Muscat', 'DD Mon YYYY, HH24:MI') || ' (Oman)' end
$$;

/** Branded HTML email. p_rows is a JSON array of [label, value] pairs (values are escaped here). */
create or replace function app.email_html(
  p_kicker text, p_title text, p_accent text, p_intro text, p_rows jsonb,
  p_button text, p_url text, p_intended text
) returns text
language plpgsql stable as $$
declare
  v_rows text := '';
  r jsonb;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if coalesce(r->>1, '') <> '' then
      v_rows := v_rows || '<tr><td style="padding:8px 0;color:#6b7c8f;font-size:13px;width:38%;vertical-align:top">' || app.h(r->>0)
        || '</td><td style="padding:8px 0;color:#0f2a47;font-size:14px;font-weight:600;vertical-align:top">' || replace(app.h(r->>1), E'\n', '<br>') || '</td></tr>';
    end if;
  end loop;
  return '<!doctype html><html><body style="margin:0;padding:0;background:#eef2f6;font-family:Inter,Segoe UI,Arial,sans-serif">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f6;padding:24px 12px"><tr><td align="center">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">'
    || '<tr><td style="height:5px;background:linear-gradient(90deg,#dd1d21 50%,#fbce07 50%);background-color:#dd1d21"></td></tr>'
    || '<tr><td style="background:#0f2a47;padding:22px 28px"><span style="font-size:24px;font-weight:800;color:#ffffff">Gem</span><span style="font-size:24px;font-weight:800;color:#fbce07">safety</span>'
    || '<div style="color:#8fa6bf;font-size:11px;letter-spacing:.16em;text-transform:uppercase;margin-top:4px">Permit to Work &amp; Competence</div></td></tr>'
    || '<tr><td style="padding:26px 28px 6px">'
    || '<div style="color:' || p_accent || ';font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">' || app.h(p_kicker) || '</div>'
    || '<h1 style="margin:6px 0 10px;color:#0f2a47;font-size:21px;line-height:1.3">' || app.h(p_title) || '</h1>'
    || '<p style="margin:0 0 14px;color:#3b4f63;font-size:14px;line-height:1.55">' || app.h(p_intro) || '</p>'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3e9ef;border-bottom:1px solid #e3e9ef;margin:6px 0 20px">' || v_rows || '</table>'
    || case when p_url is not null then '<a href="' || app.h(p_url) || '" style="display:inline-block;background:' || p_accent || ';color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:9px">' || app.h(p_button) || '</a>' else '' end
    || '</td></tr>'
    || '<tr><td style="padding:22px 28px 26px;color:#8a99a8;font-size:11.5px;line-height:1.5">'
    || 'Automated message from Gemsafety · gemsafetypro.com. Please do not reply to this email.'
    || case when p_intended is not null then '<br>Normally sent to: ' || app.h(p_intended) || '.' else '' end
    || '</td></tr></table></td></tr></table></body></html>';
end $$;

create or replace function app.record_name(p_collection text, p_id text, p_field text default 'name') returns text
language sql stable security definer set search_path = app, public as $$
  select data->>p_field from app.records where collection = p_collection and id = p_id
$$;

/** Queue one email (once per dedupe key). Never raises. */
create or replace function app.queue_email(
  p_dedupe text, p_event text, p_collection text, p_record text, p_subject text, p_html text, p_to text[], p_intended text
) returns void
language plpgsql security definer set search_path = app, public, extensions as $$
declare
  v_override jsonb := app.email_setting('override_to');
  v_to text[];
  v_key text;
  v_log bigint;
  v_req bigint;
begin
  if coalesce((app.email_setting('enabled'))::text, 'false') <> 'true' then return; end if;
  if v_override is not null and jsonb_array_length(v_override) > 0 then
    select array_agg(x) into v_to from jsonb_array_elements_text(v_override) x;
  else
    select array_agg(distinct x) into v_to from unnest(p_to) x where x like '%@%';
  end if;
  if v_to is null or cardinality(v_to) = 0 then return; end if;

  insert into app.email_log (dedupe_key, event, collection, record_id, to_addresses, intended_for, subject)
    values (p_dedupe, p_event, p_collection, p_record, v_to, p_intended, p_subject)
    on conflict (dedupe_key) do nothing
    returning id into v_log;
  if v_log is null then return; end if; -- already sent

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key';
  if v_key is null then
    update app.email_log set error = 'No Resend API key in Vault' where id = v_log;
    return;
  end if;

  select net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object('from', app.email_setting('from') #>> '{}', 'to', to_jsonb(v_to), 'subject', p_subject, 'html', p_html),
    timeout_milliseconds := 10000
  ) into v_req;
  update app.email_log set request_id = v_req where id = v_log;
exception when others then
  begin
    update app.email_log set error = sqlerrm where id = v_log;
  exception when others then null;
  end;
end $$;

/** Work out which email (if any) a saved record should trigger. */
create or replace function app.notify_record(p_collection text, p_id text, d jsonb, o jsonb) returns void
language plpgsql security definer set search_path = app, public as $$
declare
  url text := app.email_setting('app_url') #>> '{}';
  admins text[];
  issuers text[];
  st text := d->>'status';
  ost text := o->>'status';
  types text;
  station text;
  ptype text;
  applicant_email text;
  ram text;
begin
  select coalesce(array_agg(data->>'email'), '{}') into admins from app.records
    where collection = 'users' and not deleted and data->>'role' = 'ADMIN' and coalesce(data->>'email', '') like '%@%';
  select coalesce(array_agg(data->>'email'), '{}') into issuers from app.records
    where collection = 'users' and not deleted and data->>'role' = 'APPROVER' and coalesce(data->>'email', '') like '%@%';

  -- Emergency SOS button
  if p_collection = 'sosAlerts' and o is null then
    perform app.queue_email('sos:' || p_id, 'SOS_ALERT', p_collection, p_id,
      '🚨 SOS EMERGENCY ' || coalesce(d->>'refNo', '') || ' — ' || coalesce(d->>'userName', 'a worker'),
      app.email_html('Emergency alert', 'SOS raised by ' || coalesce(d->>'userName', 'a worker'), '#dd1d21',
        'An emergency SOS has just been raised in Gemsafety. Please respond immediately.',
        jsonb_build_array(
          jsonb_build_array('Reference', d->>'refNo'),
          jsonb_build_array('Emergency', d->>'kind'),
          jsonb_build_array('Raised by', concat_ws(' · ', d->>'userName', d->>'role')),
          jsonb_build_array('Phone', d->>'phone'),
          jsonb_build_array('Location', d->>'locationLabel'),
          jsonb_build_array('GPS', case when d ? 'lat' then (d->>'lat') || ', ' || (d->>'lng') || coalesce(' (±' || round((d->>'accuracy')::numeric) || ' m)', '') end),
          jsonb_build_array('Message', d->>'message'),
          jsonb_build_array('Time', app.fmt_time(d->>'createdAt'))),
        'Open on the map', 'https://maps.google.com/?q=' || coalesce(d->>'lat', '') || ',' || coalesce(d->>'lng', ''),
        'HSSE administrators'),
      admins, 'HSSE administrators');
    return;
  end if;

  -- See it · Own it · Stop it report
  if p_collection = 'hsseReports' and o is null then
    select string_agg(case t when 'NEAR_MISS' then 'Near Miss' when 'POTENTIAL_INCIDENT' then 'Potential Incident'
      when 'UNSAFE_ACT' then 'Unsafe Act' when 'UNSAFE_CONDITION' then 'Unsafe Condition' else t end, ', ')
      into types from jsonb_array_elements_text(coalesce(nullif(d->'types', '[]'::jsonb), jsonb_build_array(d->>'type'))) t;
    ram := case when coalesce((d->>'consequence')::int, 0) >= 4 then 'High potential' else null end;
    perform app.queue_email('hsse:' || p_id, 'SOS_REPORT', p_collection, p_id,
      'SOS report ' || coalesce(d->>'refNo', '') || ': ' || coalesce(d->>'title', types),
      app.email_html('See it · Own it · Stop it', coalesce(d->>'title', 'New SOS report'), '#0f2a47',
        'A new SOS report has been submitted' || case when d->>'reporterName' is not null and not coalesce((d->>'anonymous')::boolean, false) then ' by ' || (d->>'reporterName') else '' end || '.',
        jsonb_build_array(
          jsonb_build_array('Reference', d->>'refNo'),
          jsonb_build_array('Type', types),
          jsonb_build_array('Severity', concat_ws(' · ', 'Consequence ' || (d->>'consequence') || ', likelihood ' || (d->>'likelihood'), ram)),
          jsonb_build_array('Reported by', case when coalesce((d->>'anonymous')::boolean, false) then 'Anonymous' else d->>'reporterName' end),
          jsonb_build_array('Station', app.record_name('stations', d->>'stationId')),
          jsonb_build_array('Location', d->>'location'),
          jsonb_build_array('When', app.fmt_time(d->>'occurredAt')),
          jsonb_build_array('What happened', d->>'description'),
          jsonb_build_array('Immediate action', d->>'immediateAction'),
          jsonb_build_array('Work stopped', case when (d->>'stoppedWork')::boolean then 'Yes — the job was stopped / made safe' end),
          jsonb_build_array('Life-Saving Rule', d->>'lifeSavingRule'),
          jsonb_build_array('Photos', case when jsonb_array_length(coalesce(d->'photos', '[]')) > 0 then jsonb_array_length(d->'photos') || ' attached in the portal' end)),
        'Open the report', url || '/hsse/' || p_id, 'HSSE administrators'),
      admins, 'HSSE administrators');
    return;
  end if;

  -- Permit to Work steps
  if p_collection = 'applications' and st is distinct from ost and st in ('SUBMITTED', 'RESUBMITTED', 'APPROVED', 'REJECTED', 'CHANGES_REQUIRED') then
    station := app.record_name('stations', d->>'stationId');
    ptype := app.record_name('permitTypes', d->>'permitTypeId');
    applicant_email := app.record_name('users', d->>'applicantId', 'email');
    if st in ('SUBMITTED', 'RESUBMITTED') then
      perform app.queue_email('ptw:' || p_id || ':' || st || ':' || coalesce(d->>'updatedAt', ''), 'PERMIT_' || st, p_collection, p_id,
        'Permit request ' || coalesce(d->>'applicationNumber', '') || case st when 'RESUBMITTED' then ' resubmitted' else ' submitted' end || ' — ' || coalesce(station, ''),
        app.email_html('Permit to Work', 'Permit request ' || case st when 'RESUBMITTED' then 'resubmitted' else 'awaiting review' end, '#0f2a47',
          coalesce(d->>'applicantName', 'A Permit Holder') || ' has ' || case st when 'RESUBMITTED' then 'resubmitted' else 'submitted' end || ' a permit request for review.',
          jsonb_build_array(
            jsonb_build_array('Request', d->>'applicationNumber'),
            jsonb_build_array('Permit type', ptype),
            jsonb_build_array('Risk level', initcap(d->>'riskLevel')),
            jsonb_build_array('Station', station),
            jsonb_build_array('Permit Holder', d->>'applicantName'),
            jsonb_build_array('Submitted', app.fmt_time(coalesce(d->>'submittedAt', d->>'updatedAt')))),
          'Review the request', url || '/approver/applications/' || p_id, 'Permit Issuers'),
        issuers, 'Permit Issuers');
    else
      perform app.queue_email('ptw:' || p_id || ':' || st || ':' || coalesce(d->>'updatedAt', ''), 'PERMIT_' || st, p_collection, p_id,
        'Permit ' || coalesce(d->>'applicationNumber', '') || ' ' || case st when 'APPROVED' then 'approved' when 'REJECTED' then 'rejected' else 'needs changes' end,
        app.email_html('Permit to Work',
          case st when 'APPROVED' then 'Your permit has been approved' when 'REJECTED' then 'Your permit request was rejected' else 'Changes are needed on your permit request' end,
          case st when 'APPROVED' then '#1f8a4c' when 'REJECTED' then '#dd1d21' else '#b7791f' end,
          case st when 'APPROVED' then 'The Permit Issuer has approved this request. The permit PDF is available in the portal.'
            when 'REJECTED' then 'The Permit Issuer has rejected this request. See the comments in the portal.'
            else 'The Permit Issuer has asked for changes. Update the request and resubmit it.' end,
          jsonb_build_array(
            jsonb_build_array('Request', d->>'applicationNumber'),
            jsonb_build_array('Permit number', d->>'permitNumber'),
            jsonb_build_array('Permit type', ptype),
            jsonb_build_array('Station', station),
            jsonb_build_array('Permit Holder', d->>'applicantName'),
            jsonb_build_array('Valid until', app.fmt_time(d->>'expiresAt'))),
          'Open the permit', url || '/applicant/applications/' || p_id, coalesce(d->>'applicantName', 'the Permit Holder') || coalesce(' <' || applicant_email || '>', '')),
        array[applicant_email], coalesce(d->>'applicantName', 'the Permit Holder'));
    end if;
    return;
  end if;

  -- Certificate uploaded for checking
  if p_collection = 'certUploads' and o is null and st = 'PENDING' then
    perform app.queue_email('cert:' || p_id, 'CERT_UPLOADED', p_collection, p_id,
      'Certificate to check: ' || coalesce(d->>'title', d->>'code') || ' — ' || coalesce(d->>'userName', ''),
      app.email_html('Certificate check', 'A certificate is waiting for verification', '#0f2a47',
        coalesce(d->>'userName', 'A member') || ' has uploaded a certificate to their Gemsafety record.',
        jsonb_build_array(
          jsonb_build_array('Member', d->>'userName'),
          jsonb_build_array('Certificate', d->>'title'),
          jsonb_build_array('Number', d->>'number'),
          jsonb_build_array('Issued', d->>'issued'),
          jsonb_build_array('Expires', d->>'expires'),
          jsonb_build_array('Issuer', d->>'issuer')),
        'Check the certificate', url || '/admin/certificates', 'Administrators'),
      admins, 'Administrators');
    return;
  end if;

  -- Reward redemption request
  if p_collection = 'redemptions' and o is null and st = 'PENDING' then
    perform app.queue_email('redeem:' || p_id, 'REWARD_REQUEST', p_collection, p_id,
      'Reward request: ' || coalesce(d->>'rewardLabel', '') || ' — ' || coalesce(d->>'userName', ''),
      app.email_html('Points & rewards', 'New reward request', '#b7791f',
        coalesce(d->>'userName', 'A member') || ' wants to redeem points for a reward.',
        jsonb_build_array(
          jsonb_build_array('Member', d->>'userName'),
          jsonb_build_array('Reward', d->>'rewardLabel'),
          jsonb_build_array('Points', d->>'cost'),
          jsonb_build_array('Requested', app.fmt_time(d->>'requestedAt'))),
        'Review the request', url || '/admin/rewards', 'Administrators'),
      admins, 'Administrators');
    return;
  end if;

  -- Permit Holder registration
  if p_collection = 'registrations' and st = 'PENDING' and ost is distinct from 'PENDING' then
    perform app.queue_email('reg:' || p_id || ':' || coalesce(d->>'submittedAt', ''), 'REGISTRATION', p_collection, p_id,
      'Permit Holder registration: ' || coalesce(d->>'fullName', '') || coalesce(' (' || (d->>'company') || ')', ''),
      app.email_html('Training', 'New Permit Holder registration', '#0f2a47',
        coalesce(d->>'fullName', 'A trainee') || ' has completed the required courses and asked to be registered as a Permit Holder.',
        jsonb_build_array(
          jsonb_build_array('Name', d->>'fullName'),
          jsonb_build_array('Company', d->>'company'),
          jsonb_build_array('Civil ID', d->>'civilId'),
          jsonb_build_array('Phone', d->>'phone'),
          jsonb_build_array('Email', d->>'email'),
          jsonb_build_array('Submitted', app.fmt_time(d->>'submittedAt'))),
        'Review the registration', url || '/admin/training', 'Administrators'),
      admins, 'Administrators');
    return;
  end if;

  -- HSSE Focal report submitted (not workbook imports)
  if p_collection = 'focalReports' and st = 'SUBMITTED' and ost is distinct from 'SUBMITTED' and coalesce(d->>'userId', '') <> 'import-artelia' then
    perform app.queue_email('focal:' || p_id, 'FOCAL_REPORT', p_collection, p_id,
      'HSSE Focal report: ' || coalesce(d->>'company', '') || ' — ' ||
        case d->>'kind' when 'MONTHLY_STATS' then 'monthly statistics' when 'ENVIRONMENT' then 'environmental report' when 'TRAINING' then 'training report'
          when 'ERP_TEST' then 'ERP test report' when 'SITE_INSPECTION' then 'site inspection' when 'PTW_AUDIT' then 'PTW audit' else lower(d->>'kind') end,
      app.email_html('HSSE Focal', 'Report submitted by ' || coalesce(d->>'userName', 'an HSSE Focal'), '#0f2a47',
        'An HSSE Focal has submitted a report.',
        jsonb_build_array(
          jsonb_build_array('Company', d->>'company'),
          jsonb_build_array('Contract', d->>'contract'),
          jsonb_build_array('Report', replace(initcap(replace(d->>'kind', '_', ' ')), 'Ptw', 'PTW')),
          jsonb_build_array('Month', d->>'period'),
          jsonb_build_array('Date', d->>'date'),
          jsonb_build_array('Submitted by', d->>'userName')),
        'Open HSSE Focal', url || '/admin/focal', 'Administrators'),
      admins, 'Administrators');
    return;
  end if;
end $$;

create or replace function app.records_email_trigger() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  if new.deleted then return new; end if;
  begin
    perform app.notify_record(new.collection, new.id, new.data, case when tg_op = 'UPDATE' and not old.deleted then old.data else null end);
  exception when others then
    raise warning 'gemsafety email: %', sqlerrm;
  end;
  return new;
end $$;

create trigger records_email
  after insert or update on app.records
  for each row
  when (new.collection in ('sosAlerts', 'hsseReports', 'applications', 'certUploads', 'redemptions', 'registrations', 'focalReports'))
  execute function app.records_email_trigger();

revoke all on function app.queue_email(text, text, text, text, text, text, text[], text) from public;
revoke all on function app.notify_record(text, text, jsonb, jsonb) from public;
