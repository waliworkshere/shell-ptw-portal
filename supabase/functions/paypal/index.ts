// Gemsafety PayPal checkout (live).
// The browser sends its Gemsafety session token and the order it wants to pay.
// Prices come from the database (gs_paypal_prepare), never from the browser.
// The PayPal client secret stays on the server: Edge Function secret
// PAYPAL_CLIENT_SECRET if set, otherwise Supabase Vault 'paypal_client_secret'.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const PAYPAL = Deno.env.get("PAYPAL_API") ?? "https://api-m.paypal.com";
const CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") ??
  "BAAMZXKoLACeFE_mlRFAQNSKPVyT3St4gQ-CvaDofKG5f3v1Hib3aTeBANm1NvJpDTH5mt8lvNXvfmHgsE";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);

  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const rpc = (fn: string, args: Record<string, unknown> = {}) =>
    fetch(`${sbUrl}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  let body: { token?: string; action?: string; orderId?: string; kind?: string; courseId?: string; paypalOrderId?: string; items?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "BAD_REQUEST" }, 400);
  }
  const { token, action, orderId, kind, courseId, paypalOrderId, items } = body;
  const group = kind === "GROUP"; // a Company Manager paying for their staff
  if (!token || !orderId || !kind) return json({ ok: false, error: "BAD_REQUEST" }, 400);

  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET") ?? (await rpc("gs_paypal_secret"));
  if (!secret) return json({ ok: false, error: "NOT_CONFIGURED" }, 500);

  // Check the session and get the server-side price.
  const prep = group
    ? await rpc("gs_paypal_prepare_group", { p_token: token, p_cart_id: orderId, p_items: Array.isArray(items) ? items : [] })
    : await rpc("gs_paypal_prepare", { p_token: token, p_order_id: orderId, p_kind: kind, p_course_id: courseId ?? null });
  if (!prep?.ok) return json({ ok: false, error: prep?.error ?? "AUTH" }, 403);
  const amount = Number(prep.amountUsd).toFixed(2);

  const tok = await fetch(`${PAYPAL}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${CLIENT_ID}:${secret}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!tok?.access_token) return json({ ok: false, error: "PAYPAL_AUTH" }, 502);
  const pp = (path: string, init: RequestInit = {}) =>
    fetch(`${PAYPAL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });

  if (action === "create") {
    const r = await pp("/v2/checkout/orders", {
      method: "POST",
      headers: { "PayPal-Request-Id": `gs-${orderId}-${Date.now()}` },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: orderId,
          custom_id: orderId,
          invoice_id: `${orderId}-${Date.now().toString(36)}`,
          description: String(prep.label).slice(0, 120),
          amount: { currency_code: "USD", value: amount },
        }],
        application_context: { brand_name: "Gemsafety", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" },
      }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.id) return json({ ok: false, error: "PAYPAL_CREATE", detail: j?.details?.[0]?.issue ?? r.status }, 502);
    return json({ ok: true, id: j.id, amountUsd: prep.amountUsd });
  }

  if (action === "capture") {
    if (!paypalOrderId || !/^[A-Z0-9]{5,40}$/.test(paypalOrderId)) return json({ ok: false, error: "BAD_REQUEST" }, 400);
    let r = await pp(`/v2/checkout/orders/${paypalOrderId}/capture`, { method: "POST", headers: { "PayPal-Request-Id": `cap-${paypalOrderId}` } });
    let j = await r.json().catch(() => null);
    // Already captured (e.g. retry): read the order instead.
    if (!r.ok && j?.details?.[0]?.issue === "ORDER_ALREADY_CAPTURED") {
      r = await pp(`/v2/checkout/orders/${paypalOrderId}`);
      j = await r.json().catch(() => null);
    }
    if (!j) return json({ ok: false, error: "PAYPAL_CAPTURE" }, 502);
    if (j?.details?.[0]?.issue === "INSTRUMENT_DECLINED") return json({ ok: false, error: "DECLINED" }, 402);
    const unit = j.purchase_units?.[0];
    const cap = unit?.payments?.captures?.[0];
    if (j.status !== "COMPLETED" || !cap || cap.status !== "COMPLETED") {
      return json({ ok: false, error: cap?.status === "PENDING" ? "PENDING" : "NOT_COMPLETED" }, 402);
    }
    if ((unit.custom_id ?? unit.reference_id) !== orderId) return json({ ok: false, error: "MISMATCH" }, 409);
    if (cap.amount?.currency_code !== "USD" || cap.amount?.value !== amount) return json({ ok: false, error: "AMOUNT" }, 409);
    if (group) {
      const done = await rpc("gs_paypal_paid_group", { p_cart_id: orderId, p_capture_id: cap.id, p_amount: Number(amount) });
      if (!done?.ok) return json({ ok: false, error: done?.error ?? "RECORD" }, 500);
      return json({ ok: true, captureId: cap.id, orders: done.orders ?? [], subscriptions: done.subscriptions ?? {} });
    }
    const done = await rpc("gs_paypal_paid", { p_order_id: orderId, p_capture_id: cap.id, p_amount: Number(amount) });
    if (!done?.ok) return json({ ok: false, error: done?.error ?? "RECORD" }, 500);
    return json({ ok: true, captureId: cap.id, order: done.order, subscription: done.subscription ?? null });
  }

  return json({ ok: false, error: "BAD_REQUEST" }, 400);
});
