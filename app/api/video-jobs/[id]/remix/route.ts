import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) throw new Error("❌ OPENAI_API_KEY manquante");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("❌ SUPABASE_SERVICE_ROLE_KEY manquante");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("❌ NEXT_PUBLIC_SUPABASE_URL manquante");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: sourceJobId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const remixPrompt = String(body?.prompt ?? "").trim();

    if (!remixPrompt) {
      return NextResponse.json({ error: "prompt requis" }, { status: 400 });
    }

    // 🔐 Auth utilisateur via token Supabase
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");

    // ⚠️ Pour vérifier la session, on utilise un client "user" (anon key) avec setAuth
    // (mais ici on n'a pas NEXT_PUBLIC_SUPABASE_ANON_KEY côté serveur garanti),
    // donc on fait simple: supabaseAdmin.auth.getUser(token) marche avec service role.
    const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;

    if (authErr || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // ✅ Vérifie crédits (NE DÉBITE PAS ICI)
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

    const credits = Number(profile?.credits ?? 0);
    if (credits <= 0) {
      return NextResponse.json(
        { error: "Plus de crédits. Achète des crédits pour continuer." },
        { status: 402 }
      );
    }

    // ✅ Charge le job source (doit appartenir à l'user)
    const { data: source, error: srcErr } = await supabaseAdmin
      .from("video_jobs")
      .select("id,user_id,status,provider_video_id,result_video_url,prompt_final,user_prompt")
      .eq("id", sourceJobId)
      .maybeSingle();

    if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 });
    if (!source) return NextResponse.json({ error: "Source job not found" }, { status: 404 });
    if (source.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // ✅ Pour remixer, il faut un video_id OpenAI
    if (!source.provider_video_id) {
      return NextResponse.json(
        { error: "Impossible de remixer: provider_video_id manquant sur ce job." },
        { status: 400 }
      );
    }

    // (optionnel) exiger que la vidéo source soit terminée
    if (source.status !== "done") {
      return NextResponse.json(
        { error: "La vidéo source n’est pas encore terminée (status != done)." },
        { status: 400 }
      );
    }

    // ✅ 1) Crée un nouveau job en DB (remix)
    const { data: newJob, error: insErr } = await supabaseAdmin
      .from("video_jobs")
      .insert({
        user_id: user.id,
        job_type: "remix",
        parent_job_id: source.id,
        status: "queued",
        cost_credits: 1,
        user_prompt: remixPrompt,
        prompt_final: remixPrompt,
        provider: "openai",
        progress: 0,
        credits_charged: false,
        inputs: {
          remixed_from_job_id: source.id,
          remixed_from_video_id: source.provider_video_id,
          remixed_from_result_url: source.result_video_url,
        },
      })
      .select("id")
      .single();

    if (insErr || !newJob) {
      return NextResponse.json({ error: insErr?.message ?? "Failed to create remix job" }, { status: 500 });
    }

    // ✅ 2) Lance OpenAI remix (retourne un nouveau video_...)
    const remixVideo = await openai.videos.remix(source.provider_video_id, {
      prompt: remixPrompt,
    });

    // ✅ 3) Update job: provider_video_id + status processing
    const { error: updErr } = await supabaseAdmin
      .from("video_jobs")
      .update({
        provider_video_id: remixVideo.id,
        status: "processing",
        progress: Number((remixVideo as any).progress ?? 0),
      })
      .eq("id", newJob.id);

    if (updErr) {
      await supabaseAdmin
        .from("video_jobs")
        .update({ status: "failed", error_message: updErr.message })
        .eq("id", newJob.id);

      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({
      job: {
        id: newJob.id,
        status: "processing",
        provider_video_id: remixVideo.id,
      },
    });
  } catch (err: any) {
    console.error("❌ /api/video-jobs/[id]/remix error:", err);
    return NextResponse.json({ error: err?.message ?? "Internal server error" }, { status: 500 });
  }
}
