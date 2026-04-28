import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  console.log("🔔 Stripe webhook hit");

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const FIRSTPROMOTER_API_KEY = process.env.FIRSTPROMOTER_API_KEY;

  if (!STRIPE_SECRET_KEY) {
    console.error("❌ STRIPE_SECRET_KEY manquante");
    return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("❌ STRIPE_WEBHOOK_SECRET manquante");
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY manquante");
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }
  if (!SUPABASE_URL) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL manquante");
    return NextResponse.json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, { status: 500 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("❌ Missing stripe-signature header");
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("❌ Invalid signature:", err?.message || err);
    return NextResponse.json(
      { error: `Invalid signature: ${err?.message || "unknown"}` },
      { status: 400 }
    );
  }

  console.log("✅ Event verified:", event.type, event.id);

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  console.log("🧾 checkout.session.completed payment_status:", session.payment_status);

  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true, skipped: "not_paid" });
  }

  const userId = session.metadata?.user_id;
  const creditsStr = session.metadata?.credits;

  if (!userId || !creditsStr) {
    console.error("❌ Missing metadata user_id/credits");
    return NextResponse.json({ error: "Missing metadata user_id/credits" }, { status: 400 });
  }

  const credits = Number(creditsStr);
  if (!Number.isFinite(credits) || credits <= 0) {
    return NextResponse.json({ error: "Invalid credits in metadata" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("credit_ledger")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing?.id) {
    console.log("↩️ Event déjà traité, skip:", event.id);
    return NextResponse.json({ received: true, skipped: "already_processed" });
  }

  const stripeSessionId = session.id ?? null;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  let stripeChargeId: string | null = null;
  let receiptUrl: string | null = null;

  const amountTotal = typeof session.amount_total === "number" ? session.amount_total : null;
  const currency = session.currency ?? null;

  if (paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge"],
      });

      const latestCharge = pi.latest_charge as Stripe.Charge | string | null;

      if (latestCharge && typeof latestCharge !== "string") {
        stripeChargeId = latestCharge.id ?? null;
        receiptUrl = latestCharge.receipt_url ?? null;
      } else if (typeof latestCharge === "string") {
        const ch = await stripe.charges.retrieve(latestCharge);
        stripeChargeId = ch.id ?? null;
        receiptUrl = ch.receipt_url ?? null;
      }
    } catch (e: any) {
      console.warn("⚠️ Unable to retrieve charge/receipt:", e?.message || e);
    }
  }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .maybeSingle();

  if (profErr) {
    console.error("❌ profiles select error:", profErr);
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  const current = Number(profile?.credits ?? 0);
  const next = current + credits;

  const { error: updErr } = await supabase
    .from("profiles")
    .update({ credits: next, plan: "credits" })
    .eq("id", userId);

  if (updErr) {
    console.error("❌ profiles update error:", updErr);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  const { error: ledErr } = await supabase.from("credit_ledger").insert({
    user_id: userId,
    delta: credits,
    reason: `stripe_checkout_${session.metadata?.pack ?? "pack"}`,
    stripe_event_id: event.id,

    stripe_session_id: stripeSessionId,
    stripe_payment_intent_id: paymentIntentId,
    stripe_charge_id: stripeChargeId,
    amount_total: amountTotal,
    currency: currency,
    receipt_url: receiptUrl,
  });

  if (ledErr) {
    console.error("❌ credit_ledger insert error:", ledErr);
    return NextResponse.json({ error: ledErr.message }, { status: 500 });
  }

  /**
   * =====================================================
   * ✅ FirstPromoter : tracker la vente affiliée
   * =====================================================
   * Important :
   * - On le fait APRÈS le paiement Stripe confirmé.
   * - On le fait APRÈS le crédit utilisateur réussi.
   * - Si FirstPromoter échoue, on ne bloque pas le crédit.
   * - event_id évite les doublons côté FirstPromoter.
   */
  const customerEmail =
    session.customer_details?.email ||
    session.customer_email ||
    session.metadata?.user_email ||
    null;

  if (FIRSTPROMOTER_API_KEY && customerEmail && amountTotal) {
    try {
      const fpRes = await fetch("https://firstpromoter.com/api/v1/track/sale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": FIRSTPROMOTER_API_KEY,
        },
        body: JSON.stringify({
          email: customerEmail,
          event_id: event.id,
          amount: amountTotal,
          currency: (currency ?? "eur").toUpperCase(),
          ecom_sale: true,
          skip_email_notification: true,
          note: `Stripe Checkout ${session.metadata?.pack ?? "pack"} - ${stripeSessionId}`,
        }),
      });

      if (!fpRes.ok && fpRes.status !== 409) {
        const fpText = await fpRes.text();
        console.warn("⚠️ FirstPromoter sale tracking failed:", fpRes.status, fpText);
      } else {
        console.log("✅ FirstPromoter sale tracked:", fpRes.status);
      }
    } catch (e: any) {
      console.warn("⚠️ FirstPromoter sale tracking error:", e?.message || e);
    }
  } else {
    console.warn("⚠️ FirstPromoter skipped: missing API key, email, or amount", {
      hasApiKey: Boolean(FIRSTPROMOTER_API_KEY),
      customerEmail,
      amountTotal,
    });
  }

  console.log(`✅ Credits added: +${credits} (user: ${userId}) receipt:`, receiptUrl);

  return NextResponse.json({
    received: true,
    credited: credits,
    receipt_url: receiptUrl,
  });
}
