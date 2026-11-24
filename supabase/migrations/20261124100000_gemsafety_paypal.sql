-- PayPal checkout (live). The PayPal client secret lives in Supabase Vault
-- ('paypal_client_secret') or as the Edge Function secret PAYPAL_CLIENT_SECRET.
-- Prices are set here on the server, never taken from the browser.

create or replace function public.gs_paypal_secret()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'paypal_client_secret' limit 1
$$;

-- Who is buying what, for how much. Creates the order record if the browser has not synced it yet.
create or replace function public.gs_paypal_prepare(p_token text, p_order_id text, p_kind text, p_course_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_me jsonb := app.session_user(p_token); v_order jsonb; v_owner text; v_course jsonb; v_amount numeric; v_label text;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  if p_order_id is null or p_order_id !~ '^ord-[A-Za-z0-9]{4,40}$' then return jsonb_build_object('ok', false, 'error', 'BAD_REQUEST'); end if;
  if p_kind not in ('SUBSCRIPTION', 'COURSE') then return jsonb_build_object('ok', false, 'error', 'BAD_REQUEST'); end if;

  if p_kind = 'SUBSCRIPTION' then
    v_amount := 40; v_label := 'Annual subscription (Permit to Work & Journey Management)';
  else
    select data into v_course from app.records where collection = 'courses' and id = p_course_id and not deleted;
    if v_course is null then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
    v_amount := case v_course->>'tier' when 'CAT1' then 25 when 'CAT2' then 40 else 0 end;
    v_label := trim(coalesce(v_course->>'code', '') || ' ' || coalesce(v_course->>'title', 'Course'));
    if v_amount = 0 then return jsonb_build_object('ok', false, 'error', 'FREE'); end if;
  end if;

  select owner_id, data into v_owner, v_order from app.records where collection = 'orders' and id = p_order_id and not deleted;
  if v_order is not null then
    if v_order->>'userId' is distinct from v_me->>'id' then return jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); end if;
    if v_order->>'status' = 'PAID' then return jsonb_build_object('ok', false, 'error', 'ALREADY_PAID'); end if;
    if (v_order->>'amountUsd')::numeric is distinct from v_amount or v_order->>'status' <> 'PENDING' then
      update app.records set data = data || jsonb_build_object('amountUsd', v_amount, 'status', 'PENDING'), updated_at = now()
      where collection = 'orders' and id = p_order_id;
    end if;
  else
    v_order := jsonb_strip_nulls(jsonb_build_object(
      'id', p_order_id, 'userId', v_me->>'id', 'userName', v_me->>'fullName', 'company', v_me->>'company',
      'kind', p_kind, 'courseId', case when p_kind = 'COURSE' then p_course_id end, 'label', v_label,
      'amountUsd', v_amount, 'status', 'PENDING', 'requestedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
    insert into app.records (collection, id, data, owner_id, updated_at, updated_by)
    values ('orders', p_order_id, v_order, v_me->>'id', now(), v_me->>'id');
  end if;
  return jsonb_build_object('ok', true, 'orderId', p_order_id, 'userId', v_me->>'id', 'amountUsd', v_amount, 'label', v_label);
end $$;

-- Called by the paypal Edge Function only after PayPal reports the capture COMPLETED for the right amount.
create or replace function public.gs_paypal_paid(p_order_id text, p_capture_id text, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order jsonb; v_user jsonb; v_sub jsonb; v_today date := (now() at time zone 'utc')::date;
  v_from date; v_start date; v_to date; v_now text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  select data into v_order from app.records where collection = 'orders' and id = p_order_id and not deleted for update;
  if v_order is null then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if v_order->>'status' = 'PAID' then return jsonb_build_object('ok', true, 'already', true, 'order', v_order); end if;
  if (v_order->>'amountUsd')::numeric <> p_amount then return jsonb_build_object('ok', false, 'error', 'AMOUNT'); end if;

  v_order := v_order || jsonb_build_object('status', 'PAID', 'paidAt', v_now, 'confirmedBy', 'PayPal', 'reference', 'PayPal ' || p_capture_id);
  update app.records set data = v_order, updated_at = now(), updated_by = 'paypal' where collection = 'orders' and id = p_order_id;

  if v_order->>'kind' = 'SUBSCRIPTION' then
    select data into v_user from app.records where collection = 'users' and id = v_order->>'userId' and not deleted for update;
    if v_user is not null then
      v_sub := v_user->'subscription';
      if v_sub is not null and jsonb_typeof(v_sub) = 'object' and (v_sub->>'expiresAt')::date >= v_today then
        v_from := (v_sub->>'expiresAt')::date + 1; v_start := (v_sub->>'startsAt')::date;
      else
        v_from := v_today; v_start := v_today;
      end if;
      v_to := (v_from + interval '1 year' - interval '1 day')::date;
      v_user := v_user || jsonb_build_object('subscription', jsonb_build_object(
        'plan', 'ANNUAL', 'startsAt', to_char(v_start, 'YYYY-MM-DD'), 'expiresAt', to_char(v_to, 'YYYY-MM-DD'),
        'activatedBy', 'PayPal', 'activatedAt', v_now, 'orderId', p_order_id, 'reference', 'PayPal ' || p_capture_id));
      update app.records set data = v_user, updated_at = now(), updated_by = 'paypal' where collection = 'users' and id = v_order->>'userId';
    end if;
  end if;

  insert into app.records (collection, id, data, owner_id, updated_at, updated_by)
  values ('auditLogs', 'log-pp-' || p_capture_id, jsonb_build_object('id', 'log-pp-' || p_capture_id, 'at', v_now, 'action', 'ORDER_PAID',
    'actor', 'PayPal',
    'description', (v_order->>'userName') || ': ' || (v_order->>'label') || ' — paid by PayPal (' || p_capture_id || ', ' || p_amount || ' USD)'),
    v_order->>'userId', now(), 'paypal')
  on conflict do nothing;
  return jsonb_build_object('ok', true, 'order', v_order, 'subscription', v_user->'subscription');
end $$;

revoke all on function public.gs_paypal_secret() from public, anon, authenticated;
revoke all on function public.gs_paypal_prepare(text, text, text, text) from public, anon, authenticated;
revoke all on function public.gs_paypal_paid(text, text, numeric) from public, anon, authenticated;
grant execute on function public.gs_paypal_secret() to service_role;
grant execute on function public.gs_paypal_prepare(text, text, text, text) to service_role;
grant execute on function public.gs_paypal_paid(text, text, numeric) to service_role;
