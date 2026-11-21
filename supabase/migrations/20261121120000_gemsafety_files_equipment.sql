-- =====================================================================
-- Gemsafety - scanned documents and equipment certificates (21 Nov 2026)
--  * app.files: uploaded pages / PDFs kept outside app.records, so they
--    are not downloaded with everyone's data; fetched one at a time.
--    Images are compressed in the browser (about 150 KB a page); the
--    server refuses anything over 1 MB.
--  * Equipment certificates (certUploads with an "equipment" block) are
--    stamped with the uploader's company and visible to that company.
-- =====================================================================

create table if not exists app.files (
  id text primary key,
  owner_id text not null,
  company text,
  ref_collection text,
  ref_id text,
  name text not null,
  mime text not null,
  size_bytes int not null,
  data text not null,
  created_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index if not exists files_owner_idx on app.files (owner_id, created_at);
alter table app.files enable row level security;

create or replace function public.gs_file_put(p_token text, p_id text, p_name text, p_mime text, p_data text,
  p_ref_collection text default null, p_ref_id text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_me jsonb := app.session_user(p_token); v_uid text; v_bytes int; v_today int;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  v_uid := v_me->>'id';
  if coalesce(p_id, '') !~ '^[A-Za-z0-9_-]{6,80}$' then return jsonb_build_object('ok', false, 'error', 'BAD_ID'); end if;
  if p_mime not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then return jsonb_build_object('ok', false, 'error', 'TYPE'); end if;
  if p_data is null or p_data !~ '^data:[a-z/]+;base64,' then return jsonb_build_object('ok', false, 'error', 'BAD_DATA'); end if;
  v_bytes := (length(p_data) - position(',' in p_data)) * 3 / 4;
  if v_bytes > 1048576 then return jsonb_build_object('ok', false, 'error', 'TOO_BIG'); end if;
  select count(*) into v_today from app.files where owner_id = v_uid and created_at > now() - interval '1 day';
  if v_today >= 200 then return jsonb_build_object('ok', false, 'error', 'QUOTA'); end if;
  insert into app.files (id, owner_id, company, ref_collection, ref_id, name, mime, size_bytes, data)
    values (p_id, v_uid, nullif(v_me->>'company', ''), p_ref_collection, p_ref_id, left(coalesce(p_name, 'document'), 160), p_mime, v_bytes, p_data)
    on conflict (id) do nothing;
  if not exists (select 1 from app.files where id = p_id and owner_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  return jsonb_build_object('ok', true, 'id', p_id, 'size', v_bytes);
end $$;

create or replace function public.gs_file_get(p_token text, p_id text) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare v_me jsonb := app.session_user(p_token); v_f app.files; v_co text;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  select * into v_f from app.files where id = p_id and not deleted;
  if v_f.id is null then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  v_co := app.approver_company(v_me);
  if not (v_f.owner_id = v_me->>'id' or app.is_staff(v_me->>'role')
          or coalesce((v_me->>'countryLead')::boolean, false)
          or (v_co is not null and v_f.company = v_co)
          or (v_f.company is not null and v_f.company = v_me->>'company')) then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  return jsonb_build_object('ok', true, 'id', v_f.id, 'name', v_f.name, 'mime', v_f.mime, 'size', v_f.size_bytes, 'data', v_f.data);
end $$;

revoke all on function public.gs_file_put(text, text, text, text, text, text, text) from public;
revoke all on function public.gs_file_get(text, text) from public;
grant execute on function public.gs_file_put(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.gs_file_get(text, text) to anon, authenticated;

create or replace function app._patch(p_src text, p_old text, p_new text) returns text
language plpgsql immutable as $$
begin
  if position(p_old in p_src) = 0 then raise exception 'gemsafety patch: text not found: %', left(p_old, 120); end if;
  return replace(p_src, p_old, p_new);
end $$;

do $$
declare d text;
begin
  -- A company's equipment certificates are visible to everyone in that company.
  d := pg_get_functiondef('public.gs_state(text,timestamptz)'::regprocedure);
  d := app._patch(d, $x$or (r.collection = 'hsseReports' and coalesce((v_me->>'countryLead')::boolean, false))$x$,
                     $x$or (r.collection = 'hsseReports' and coalesce((v_me->>'countryLead')::boolean, false))
         or (r.collection = 'certUploads' and r.data ? 'equipment' and v_co is not null and r.data->'equipment'->>'company' = v_co)$x$);
  execute d;

  -- Equipment certificates carry the uploader's company (set by the server).
  d := pg_get_functiondef('public.gs_sync(text,jsonb)'::regprocedure);
  d := app._patch(d, $x$        and (v_old is null or (v_old_owner = v_uid and (v_old->>'status') in ('PENDING', 'REJECTED')));$x$,
                     $x$        and (v_old is null or (v_old_owner = v_uid and (v_old->>'status') in ('PENDING', 'REJECTED')));
      if v_ok and jsonb_typeof(v_d->'equipment') = 'object' then
        v_d := jsonb_set(v_d, '{equipment,company}', to_jsonb(coalesce(v_me->>'company', '')));
      end if;$x$);
  execute d;
end $$;

drop function app._patch(text, text, text);
