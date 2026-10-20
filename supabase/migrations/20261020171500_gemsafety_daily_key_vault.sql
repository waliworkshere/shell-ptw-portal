-- Daily.co API key lives in Supabase Vault; only the video-call Edge Function
-- (service role) can read it. Add the key with:
--   select vault.create_secret('<DAILY_API_KEY>', 'daily_api_key', 'Daily.co API key');
create or replace function public.gs_daily_key() returns text
language sql security definer stable set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'daily_api_key' limit 1
$$;
revoke all on function public.gs_daily_key() from public, anon, authenticated;
grant execute on function public.gs_daily_key() to service_role;
