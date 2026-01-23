import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

if (!process.env.STRIPE_SECRET_KEY) throw new Error("❌ STRIPE_SECRET_KEY manquante");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("❌ SUPABASE_SERVICE_ROLE_KEY manquante");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("❌ NEXT_PUBLIC_SUPABASE_URL manquante");
if (!process.env.NEXT_PUBLIC_APP_URL) throw new Error("❌ NEXT_PUBLIC_APP_URL manquante (ex: http://localhost:3000)");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ Packs (Price IDs fournis)
const PACKS: Record<string, { priceId: string; credits: number }> = {
  unit: { priceId: "price_1Sr4q16ZcT8AA1oB3P4mjkuW", credits: 1 },
  pack10: { priceId: "price_1Sr53g6ZcT8AA1oBiWF1S1rv", credits: 10 },
  pack20: { priceId: "price_1Sr58k6ZcT8AA1oBKnftK37U", credits: 20 },
  pack40: { priceId: "price_1Sr59L6ZcT8AA1oBRjE33NfO", credits: 40 },
};

export async function POST(req: Request) {
  try {
    const { pack } = await req.json();

    if (!pack || !PACKS[pack]) {
      return NextResponse.json({ error: "Pack invalide" }, { status: 400 });
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const credits = PACKS[pack].credits;

    // ✅ Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: user.id, // utile côté Stripe
      line_items: [
        {
          price: PACKS[pack].priceId,
          quantity: 1,
        },
      ],

      // ✅ Important : mets les metadata sur la session ET le payment intent
      // (webhooks: tu peux lire l’un ou l’autre)
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

      // ✅ Pour afficher "✅ Paiement réussi" sur /app/credits
      success_url: `${appUrl}/app/credits?checkout=success`,
      cancel_url: `${appUrl}/app/credits?checkout=cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("❌ /api/stripe/checkout error:", err);
    return NextResponse.json({ error: err?.message ?? "Stripe error" }, { status: 500 });
  }
}
