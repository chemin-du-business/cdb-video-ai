import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("❌ SUPABASE_SERVICE_ROLE_KEY manquante");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("❌ NEXT_PUBLIC_SUPABASE_URL manquante");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (authErr || !user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const { data, error } = await supabase
      .from("credit_ledger")
      .select("id, delta, reason, created_at, stripe_event_id, receipt_url, amount_total, currency, pack")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ receipts: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
  }
}
