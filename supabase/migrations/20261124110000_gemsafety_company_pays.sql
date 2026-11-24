-- Company Managers pay for their own staff's courses and annual subscriptions (PayPal, one checkout).

create table if not exists app.paypal_carts (
  id text primary key,
  payer_id text not null,
  data jsonb not null,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table app.paypal_carts enable row level security;
revoke all on app.paypal_carts from public, anon, authenticated;

create or replace function app.pp_now() returns text language sql stable set search_path = '' as $$
  select to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- Start or extend a person's annual subscription by one year. Returns the new subscription.
create or replace function app.pp_extend_sub(p_user_id text, p_order_id text, p_ref text, p_by text)
returns jsonb language plpgsql set search_path = '' as $$
declare v_user jsonb; v_sub jsonb; v_today date := (now() at time zone 'utc')::date; v_from date; v_start date; v_to date;
begin
  select data into v_user from app.records where collection = 'users' and id = p_user_id and not deleted for update;
  if v_user is null then return null; end if;
  v_sub := v_user->'subscription';
  if v_sub is not null and jsonb_typeof(v_sub) = 'object' and (v_sub->>'expiresAt')::date >= v_today then
    v_from := (v_sub->>'expiresAt')::date + 1; v_start := (v_sub->>'startsAt')::date;
  else
    v_from := v_today; v_start := v_today;
  end if;
  v_to := (v_from + interval '1 year' - interval '1 day')::date;
  v_sub := jsonb_build_object('plan', 'ANNUAL', 'startsAt', to_char(v_start, 'YYYY-MM-DD'), 'expiresAt', to_char(v_to, 'YYYY-MM-DD'),
    'activatedBy', p_by, 'activatedAt', app.pp_now(), 'orderId', p_order_id, 'reference', p_ref);
  update app.records set data = data || jsonb_build_object('subscription', v_sub), updated_at = now(), updated_by = 'paypal'
  where collection = 'users' and id = p_user_id;
  return v_sub;
end $$;

-- The Company Manager's staff, with what is already paid. Only their own company.
create or replace function public.gs_company_staff(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_me jsonb := app.session_user(p_token); v_co text;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  v_co := nullif(trim(v_me->>'company'), '');
  if v_me->>'role' not in ('COMPANY_MANAGER', 'ADMIN') or v_co is null then return jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); end if;
  return jsonb_build_object('ok', true, 'company', v_co, 'staff', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', u.id, 'fullName', u.data->>'fullName', 'role', u.data->>'role', 'position', u.data->>'position',
      'subscriptionExpires', u.data->'subscription'->>'expiresAt',
      'paidCourseIds', coalesce((select jsonb_agg(distinct o.data->>'courseId') from app.records o
        where o.collection = 'orders' and not o.deleted and o.data->>'userId' = u.id and o.data->>'kind' = 'COURSE' and o.data->>'status' = 'PAID'), '[]'::jsonb),
      'enrolledCourseIds', coalesce((select jsonb_agg(distinct e.data->>'courseId') from app.records e
        where e.collection = 'enrollments' and not e.deleted and e.data->>'userId' = u.id), '[]'::jsonb)
    ) order by u.data->>'fullName')
    from app.records u
    where u.collection = 'users' and not u.deleted and not (u.data ? 'deactivated')
      and lower(trim(u.data->>'company')) = lower(v_co) and u.data->>'role' in ('APPLICANT', 'TRAINEE') and u.id <> v_me->>'id'
  ), '[]'::jsonb));
end $$;
grant execute on function public.gs_company_staff(text) to anon, authenticated, service_role;

-- Check a Company Manager's basket and price it on the server. Called by the paypal Edge Function only.
create or replace function public.gs_paypal_prepare_group(p_token text, p_cart_id text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_me jsonb := app.session_user(p_token); v_co text; it jsonb; v_user jsonb; v_course jsonb; v_amount numeric;
  v_total numeric := 0; v_out jsonb := '[]'::jsonb; v_seen text[] := '{}'; v_key text; v_cart record;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  v_co := nullif(trim(v_me->>'company'), '');
  if v_me->>'role' not in ('COMPANY_MANAGER', 'ADMIN') or v_co is null then return jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); end if;
  if p_cart_id is null or p_cart_id !~ '^cart-[A-Za-z0-9]{4,40}$' then return jsonb_build_object('ok', false, 'error', 'BAD_REQUEST'); end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 60 then
    return jsonb_build_object('ok', false, 'error', 'BAD_REQUEST'); end if;

  select * into v_cart from app.paypal_carts where id = p_cart_id;
  if found and (v_cart.status = 'PAID' or v_cart.payer_id <> v_me->>'id') then return jsonb_build_object('ok', false, 'error', 'ALREADY_PAID'); end if;

  for it in select * from jsonb_array_elements(p_items) loop
    select data into v_user from app.records where collection = 'users' and id = it->>'userId' and not deleted;
    if v_user is null or lower(trim(v_user->>'company')) <> lower(v_co) or v_user->>'role' not in ('APPLICANT', 'TRAINEE') then
      return jsonb_build_object('ok', false, 'error', 'NOT_YOUR_STAFF'); end if;
    v_key := (it->>'userId') || '|' || (it->>'kind') || '|' || coalesce(it->>'courseId', '');
    if v_key = any(v_seen) then return jsonb_build_object('ok', false, 'error', 'DUPLICATE'); end if;
    v_seen := v_seen || v_key;
    if it->>'kind' = 'SUBSCRIPTION' then
      v_out := v_out || jsonb_build_object('userId', v_user->>'id', 'userName', v_user->>'fullName', 'company', v_user->>'company',
        'kind', 'SUBSCRIPTION', 'label', 'Annual subscription (Permit to Work & Journey Management)', 'amountUsd', 40);
      v_total := v_total + 40;
    elsif it->>'kind' = 'COURSE' then
      select data into v_course from app.records where collection = 'courses' and id = it->>'courseId' and not deleted;
      if v_course is null then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
      v_amount := case v_course->>'tier' when 'CAT1' then 25 when 'CAT2' then 40 else 0 end;
      if v_amount = 0 then return jsonb_build_object('ok', false, 'error', 'FREE'); end if;
      if exists (select 1 from app.records o where o.collection = 'orders' and not o.deleted and o.data->>'userId' = v_user->>'id'
          and o.data->>'kind' = 'COURSE' and o.data->>'courseId' = v_course->>'id' and o.data->>'status' = 'PAID') then
        return jsonb_build_object('ok', false, 'error', 'ALREADY_HAS_COURSE'); end if;
      v_out := v_out || jsonb_build_object('userId', v_user->>'id', 'userName', v_user->>'fullName', 'company', v_user->>'company',
        'kind', 'COURSE', 'courseId', v_course->>'id', 'label', trim(coalesce(v_course->>'code', '') || ' ' || coalesce(v_course->>'title', 'Course')), 'amountUsd', v_amount);
      v_total := v_total + v_amount;
    else
      return jsonb_build_object('ok', false, 'error', 'BAD_REQUEST');
    end if;
  end loop;

  insert into app.paypal_carts (id, payer_id, data) values (p_cart_id, v_me->>'id',
    jsonb_build_object('payerId', v_me->>'id', 'payerName', v_me->>'fullName', 'company', v_co, 'items', v_out, 'totalUsd', v_total))
  on conflict (id) do update set data = excluded.data;
  return jsonb_build_object('ok', true, 'amountUsd', v_total,
    'label', 'Gemsafety: ' || jsonb_array_length(v_out) || ' item(s) for ' || v_co);
end $$;

-- After PayPal confirms the capture: one paid order per staff item, subscriptions extended.
create or replace function public.gs_paypal_paid_group(p_cart_id text, p_capture_id text, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cart record; it jsonb; i int := 0; v_now text := app.pp_now(); v_ref text := 'PayPal ' || p_capture_id;
  v_order jsonb; v_orders jsonb := '[]'::jsonb; v_subs jsonb := '{}'::jsonb; v_sub jsonb; v_payer text;
begin
  select * into v_cart from app.paypal_carts where id = p_cart_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if v_cart.status = 'PAID' then return jsonb_build_object('ok', true, 'already', true, 'orders', v_cart.data->'orders'); end if;
  if (v_cart.data->>'totalUsd')::numeric <> p_amount then return jsonb_build_object('ok', false, 'error', 'AMOUNT'); end if;
  v_payer := v_cart.data->>'payerName';

  for it in select * from jsonb_array_elements(v_cart.data->'items') loop
    i := i + 1;
    v_order := jsonb_strip_nulls(jsonb_build_object('id', 'ord-' || replace(p_cart_id, 'cart-', '') || 'x' || i,
      'userId', it->>'userId', 'userName', it->>'userName', 'company', it->>'company', 'kind', it->>'kind', 'courseId', it->>'courseId',
      'label', it->>'label', 'amountUsd', (it->>'amountUsd')::numeric, 'status', 'PAID', 'requestedAt', v_now, 'paidAt', v_now,
      'confirmedBy', 'PayPal', 'reference', v_ref, 'note', 'Paid by ' || v_payer || ' (company)'));
    insert into app.records (collection, id, data, owner_id, updated_at, updated_by)
    values ('orders', v_order->>'id', v_order, it->>'userId', now(), 'paypal')
    on conflict (collection, id) do update set data = excluded.data, updated_at = now(), updated_by = 'paypal';
    if it->>'kind' = 'SUBSCRIPTION' then
      v_sub := app.pp_extend_sub(it->>'userId', v_order->>'id', v_ref, 'PayPal (paid by ' || v_payer || ')');
      if v_sub is not null then v_subs := v_subs || jsonb_build_object(it->>'userId', v_sub); end if;
    end if;
    v_orders := v_orders || v_order;
  end loop;

  update app.paypal_carts set status = 'PAID', paid_at = now(), data = data || jsonb_build_object('orders', v_orders, 'captureId', p_capture_id)
  where id = p_cart_id;
  insert into app.records (collection, id, data, owner_id, updated_at, updated_by)
  values ('auditLogs', 'log-pp-' || p_capture_id, jsonb_build_object('id', 'log-pp-' || p_capture_id, 'at', v_now, 'action', 'ORDER_PAID',
    'actor', 'PayPal', 'description', v_payer || ' (' || (v_cart.data->>'company') || ') paid ' || p_amount || ' USD by PayPal for ' || i || ' staff item(s) (' || p_capture_id || ')'),
    v_cart.payer_id, now(), 'paypal')
  on conflict do nothing;
  return jsonb_build_object('ok', true, 'orders', v_orders, 'subscriptions', v_subs);
end $$;

revoke all on function public.gs_paypal_prepare_group(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.gs_paypal_paid_group(text, text, numeric) from public, anon, authenticated;
grant execute on function public.gs_paypal_prepare_group(text, text, jsonb) to service_role;
grant execute on function public.gs_paypal_paid_group(text, text, numeric) to service_role;
revoke all on function app.pp_extend_sub(text, text, text, text) from public, anon, authenticated;
