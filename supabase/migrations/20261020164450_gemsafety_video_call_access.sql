-- Who may join the video verification call for a permit application:
-- Permit Issuers / Administrators, and the applicant themself.
create or replace function public.gs_call_access(p_token text, p_application_id text) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare v_me jsonb := app.session_user(p_token); v_owner text; v_role text;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  select owner_id into v_owner from app.records where collection = 'applications' and id = p_application_id and not deleted;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  v_role := v_me->>'role';
  if v_role in ('ADMIN', 'APPROVER') or v_owner = v_me->>'id' then
    return jsonb_build_object('ok', true, 'userId', v_me->>'id', 'name', v_me->>'fullName', 'staff', v_role in ('ADMIN', 'APPROVER'));
  end if;
  return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
end $$;
