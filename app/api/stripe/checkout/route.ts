// app/api/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ Packs (LIVE Price IDs)
const PACKS: Record<string, { priceId: string; credits: number }> = {
  pack2: { priceId: "price_1Stxft5QaJyDupOG5dcvctmJ", credits: 2 },
  pack10: { priceId: "price_1Stxdm5QaJyDupOGc5TvKJFr", credits: 10 },
  pack20: { priceId: "price_1Stxdh5QaJyDupOGlz1AuV8a", credits: 20 },
  pack40: { priceId: "price_1StxdZ5QaJyDupOGlBr2cDBL", credits: 40 },
};

export async function POST(req: Request) {
  try {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

    if (!STRIPE_SECRET_KEY) throw new Error("❌ STRIPE_SECRET_KEY manquante");
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("❌ SUPABASE_SERVICE_ROLE_KEY manquante");
    if (!SUPABASE_URL) throw new Error("❌ NEXT_PUBLIC_SUPABASE_URL manquante");
    if (!APP_URL) throw new Error("❌ NEXT_PUBLIC_APP_URL manquante (ex: https://cdbvideoia.com)");

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { pack } = await req.json();

    if (!pack || !PACKS[pack]) {
      return NextResponse.json(
        { error: "Pack invalide", allowed: Object.keys(PACKS) },
        { status: 400 }
      );
    }

    // 🔐 Auth utilisateur via token Supabase (envoyé depuis le front)
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    const user = userData?.user;

    if (authErr || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const credits = PACKS[pack].credits;

    // ✅ Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: user.id,
      line_items: [
        {
          price: PACKS[pack].priceId,
          quantity: 1,
        },
      ],

      // ✅ metadata sur session + payment intent (utile pour webhook)
      metadata: {
        user_id: user.id,
        pack,
        credits: String(credits),
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          pack,
          credits: String(credits),
        },
      },

      success_url: `${APP_URL}/app/credits?checkout=success`,
      cancel_url: `${APP_URL}/app/credits?checkout=cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("❌ /api/checkout error:", err);
    return NextResponse.json({ error: err?.message ?? "Stripe error" }, { status: 500 });
  }
}
