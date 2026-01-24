import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

if (!process.env.CRON_SECRET) throw new Error("❌ CRON_SECRET manquante");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("❌ NEXT_PUBLIC_SUPABASE_URL manquante");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("❌ SUPABASE_SERVICE_ROLE_KEY manquante");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getBaseUrl(req: Request) {
  // ✅ robuste en prod (Vercel)
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  // fallback si jamais env manquante
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

export async function GET(req: Request, context: { params: Promise<{ secret: string }> }) {
  const { secret } = await context.params;

  // ✅ Sécurité
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = getBaseUrl(req);

  // ✅ Récupérer des jobs à refresh
  // (tu peux augmenter limit si tu veux, mais 50 est safe)
  const { data: jobs, error } = await supabase
    .from("video_jobs")
    .select("id,status,provider_video_id,created_at")
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ ok: true, refreshed: 0 });
  }

  // ✅ Appeler TON refresh endpoint pour chaque job
  // IMPORTANT : ton /api/video-jobs/[id]/refresh ne check pas Authorization → OK pour cron
  const results = await Promise.allSettled(
    jobs.map(async (j) => {
      const url = `${baseUrl}/api/video-jobs/${j.id}/refresh`;

      const r = await fetch(url, {
        method: "POST",
        // on envoie un header juste pour debug / traçage
        headers: { "x-cron": "1" },
      });

      const body = await r.json().catch(() => null);

      return {
        id: j.id,
        http: r.status,
        body,
      };
    })
  );

  return NextResponse.json({
    ok: true,
    refreshed: jobs.length,
    results,
  });
}
