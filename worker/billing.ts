import { getSessionUser } from "./auth";

type BillingEnv = {
  DB: D1Database;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_MONTHLY_PRICE_ID?: string;
  STRIPE_YEARLY_PRICE_ID?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  AUTH_SECRET?: string;
  INITIAL_ADMIN_EMAIL?: string;
  INITIAL_ADMIN_EMAILS?: string;
};

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

async function stripe(path: string, env: BillingEnv, values: Record<string, string>) {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Payments are not connected yet.");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(values),
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(String((data.error as { message?: string } | undefined)?.message || "Stripe could not complete that request."));
  return data;
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function verifyWebhook(payload: string, signature: string, secret: string) {
  const parts = Object.fromEntries(signature.split(",").map((part) => part.split("=")));
  if (!parts.t || !parts.v1 || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${payload}`));
  const expected = hex(signed);
  if (expected.length !== parts.v1.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return mismatch === 0;
}

export async function handleBillingRequest(request: Request, env: BillingEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/billing/") && url.pathname !== "/api/stripe/webhook") return null;

  if (url.pathname === "/api/stripe/webhook" && request.method === "POST") {
    if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: "Webhook is not configured." }, 503);
    const payload = await request.text();
    if (!await verifyWebhook(payload, request.headers.get("stripe-signature") || "", env.STRIPE_WEBHOOK_SECRET)) {
      return json({ error: "Invalid webhook signature." }, 400);
    }
    const event = JSON.parse(payload) as { id: string; type: string; data: { object: Record<string, unknown> } };
    const object = event.data.object;
    const customerId = String(object.customer || (object.object === "customer" ? object.id : ""));
    if (event.type === "checkout.session.completed") {
      const userId = String((object.metadata as Record<string, unknown> | undefined)?.user_id || object.client_reference_id || "");
      if (userId) await env.DB.prepare("UPDATE users SET stripe_customer_id = ?, stripe_subscription_id = ?, access_status = 'trialing', updated_at = ? WHERE id = ?")
        .bind(customerId, String(object.subscription || ""), new Date().toISOString(), userId).run();
    }
    if (event.type.startsWith("customer.subscription.")) {
      const status = String(object.status || "inactive");
      const access = ["active", "trialing"].includes(status) ? status : status === "past_due" ? "past_due" : "inactive";
      const periodEnd = object.current_period_end ? new Date(Number(object.current_period_end) * 1000).toISOString() : null;
      await env.DB.prepare("UPDATE users SET stripe_subscription_id = ?, subscription_status = ?, access_status = CASE WHEN billing_exempt = 1 OR access_status = 'complimentary' THEN access_status ELSE ? END, subscription_ends_at = ?, updated_at = ? WHERE stripe_customer_id = ?")
        .bind(String(object.id || ""), status, access, periodEnd, new Date().toISOString(), customerId).run();
    }
    return json({ received: true });
  }

  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "Sign in before choosing a plan." }, 401);

  if (url.pathname === "/api/billing/checkout" && request.method === "POST") {
    if (user.billingExempt || user.accessStatus === "complimentary") return json({ error: "This account already has complimentary access." }, 400);
    const body = await request.json() as { plan?: "monthly" | "yearly" };
    const price = body.plan === "yearly" ? env.STRIPE_YEARLY_PRICE_ID : env.STRIPE_MONTHLY_PRICE_ID;
    if (!price) return json({ error: "Payments are being connected. Please check back shortly." }, 503);
    const origin = url.origin;
    try {
      const session = await stripe("checkout/sessions", env, {
        mode: "subscription",
        "line_items[0][price]": price,
        "line_items[0][quantity]": "1",
        customer_email: user.email,
        client_reference_id: user.id,
        "metadata[user_id]": user.id,
        "subscription_data[trial_period_days]": "30",
        "subscription_data[metadata][user_id]": user.id,
        success_url: `${origin}/?billing=success`,
        cancel_url: `${origin}/?billing=cancelled`,
        allow_promotion_codes: "true",
      });
      return json({ url: session.url });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Checkout is unavailable." }, 502);
    }
  }

  if (url.pathname === "/api/billing/portal" && request.method === "POST") {
    const row = await env.DB.prepare("SELECT stripe_customer_id FROM users WHERE id = ?").bind(user.id).first();
    if (!row?.stripe_customer_id) return json({ error: "Choose a plan before managing billing." }, 400);
    try {
      const session = await stripe("billing_portal/sessions", env, { customer: String(row.stripe_customer_id), return_url: `${url.origin}/?billing=return` });
      return json({ url: session.url });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Billing management is unavailable." }, 502);
    }
  }

  return json({ error: "Not found." }, 404);
}
