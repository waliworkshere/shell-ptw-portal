// Gemsafety video verification calls (Daily.co).
// The Daily API key never leaves the server: the browser sends its Gemsafety
// session token, we check it in the database, then hand back a short-lived
// meeting token for a private room tied to the permit application.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const DAILY = "https://api.daily.co/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);

  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Daily key: an Edge Function secret if set, otherwise from Supabase Vault (service role only).
  let apiKey = Deno.env.get("DAILY_API_KEY");
  if (!apiKey) {
    apiKey = await fetch(`${sbUrl}/rest/v1/rpc/gs_daily_key`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: "{}",
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null) ?? undefined;
  }
  if (!apiKey) return json({ ok: false, error: "NOT_CONFIGURED" }, 500);

  let body: { token?: string; applicationId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "BAD_REQUEST" }, 400);
  }
  const { token, applicationId, action = "join" } = body;
  if (!token || !applicationId) return json({ ok: false, error: "BAD_REQUEST" }, 400);

  // 1. Is this person allowed on this application's call?
  const sbKey = Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey;
  const check = await fetch(`${sbUrl}/rest/v1/rpc/gs_call_access`, {
    method: "POST",
    headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, p_application_id: applicationId }),
  }).then((r) => r.json()).catch(() => null);
  if (!check?.ok) return json({ ok: false, error: check?.error ?? "AUTH" }, 403);

  const daily = (path: string, init: RequestInit = {}) =>
    fetch(`${DAILY}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  const room = "ptw-" + applicationId.replace(/[^A-Za-z0-9-]/g, "").slice(0, 60);

  // 2. Ending the call removes the room so nobody can rejoin.
  if (action === "end") {
    if (!check.staff) return json({ ok: false, error: "FORBIDDEN" }, 403);
    await daily(`/rooms/${room}`, { method: "DELETE" });
    return json({ ok: true });
  }

  // 3. Find or (Permit Issuer only) open the private room.
  const exp = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
  let r = await daily(`/rooms/${room}`);
  if (r.status === 404) {
    if (!check.staff) return json({ ok: false, error: "NOT_STARTED" }, 409);
    r = await daily("/rooms", {
      method: "POST",
      body: JSON.stringify({
        name: room,
        privacy: "private",
        properties: { exp, eject_at_room_exp: true, max_participants: 4, enable_chat: false, enable_prejoin_ui: false, start_video_off: false },
      }),
    });
  }
  if (!r.ok) return json({ ok: false, error: "DAILY_ROOM", detail: await r.text() }, 502);
  const roomInfo = await r.json();

  // 4. A meeting token just for this person.
  const t = await daily("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: { room_name: room, user_name: check.name, user_id: check.userId, is_owner: !!check.staff, exp },
    }),
  });
  if (!t.ok) return json({ ok: false, error: "DAILY_TOKEN", detail: await t.text() }, 502);
  const { token: meetingToken } = await t.json();
  return json({ ok: true, url: roomInfo.url, token: meetingToken, staff: !!check.staff });
});
