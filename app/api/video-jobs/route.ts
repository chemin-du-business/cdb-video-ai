// /app/api/video-jobs/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

if (!process.env.OPENAI_API_KEY) throw new Error("❌ OPENAI_API_KEY manquante");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("❌ SUPABASE_SERVICE_ROLE_KEY manquante");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL)
  throw new Error("❌ NEXT_PUBLIC_SUPABASE_URL manquante");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function isInsufficientCreditsError(message?: string) {
  const m = (message ?? "").toUpperCase();
  return m.includes("INSUFFICIENT_CREDITS");
}

export async function POST(req: Request) {
  try {
    const { template_id, user_prompt } = await req.json();

    if (!user_prompt || !String(user_prompt).trim()) {
      return NextResponse.json({ error: "user_prompt requis" }, { status: 400 });
    }

    // 🔐 Auth utilisateur via token Supabase
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    const user = userData?.user;

    if (authErr || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    /**
     * PROMPT
     */
    let prompt_final = String(user_prompt).trim();

    if (template_id) {
      const { data: tpl, error: tplErr } = await supabase
        .from("templates")
        .select("prompt_prefix, prompt_suffix")
        .eq("id", template_id)
        .maybeSingle();

      if (tplErr) return NextResponse.json({ error: tplErr.message }, { status: 500 });
      if (!tpl) return NextResponse.json({ error: "Template introuvable" }, { status: 400 });

      prompt_final = `${tpl.prompt_prefix ?? ""} ${user_prompt} ${tpl.prompt_suffix ?? ""}`.trim();
    }

    /**
     * 1) CRÉATION DU JOB
     * ✅ status: "queued" => trigger DB débite immédiatement (ou throw INSUFFICIENT_CREDITS)
     */
    const { data: job, error: jobErr } = await supabase
      .from("video_jobs")
      .insert({
        user_id: user.id,
        template_id: template_id ?? null,
        user_prompt: String(user_prompt).trim(),
        prompt_final,
        status: "queued",
        provider: "openai",
        progress: 0,
        job_type: template_id ? "remix" : "generate", // optionnel
        cost_credits: 1,
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      console.error("❌ Job insert error:", jobErr);

      if (isInsufficientCreditsError(jobErr?.message)) {
        return NextResponse.json(
          { error: "Plus de crédits. Achète des crédits pour continuer." },
          { status: 402 }
        );
      }

      return NextResponse.json(
        { error: jobErr?.message ?? "Failed to create job" },
        { status: 500 }
      );
    }

    console.log("✅ job created:", job.id);
    console.log("🎬 launching Sora (PRO)…");

    /**
     * 2) APPEL SORA — QUALITÉ MAX
     */
    let video: any;
    try {
      video = await openai.videos.create({
        model: "sora-2-pro",
        prompt: prompt_final,
        seconds: "12",
        size: "720x1280",
      });
    } catch (e: any) {
      console.error("❌ Sora create failed:", e);

      // ✅ failed => trigger DB refund
      await supabase
        .from("video_jobs")
        .update({
          status: "failed",
          error_message: e?.message ?? "Sora create failed",
        })
        .eq("id", job.id);

      return NextResponse.json(
        { error: "Failed to create video with provider" },
        { status: 500 }
      );
    }

    console.log("✅ Sora created:", video.id);

    /**
     * 3) UPDATE JOB
     */
    const { error: updErr } = await supabase
      .from("video_jobs")
      .update({
        provider_video_id: video.id,
        status: "processing",
        progress: (video as any).progress ?? 0,
      })
      .eq("id", job.id);

    if (updErr) {
      console.error("❌ FAILED to update provider_video_id:", updErr);

      // ✅ failed => trigger DB refund
      await supabase
        .from("video_jobs")
        .update({ status: "failed", error_message: updErr.message })
        .eq("id", job.id);

      return NextResponse.json(
        { error: "Failed to update job after Sora create", details: updErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      job: {
        id: job.id,
        status: "processing",
        provider_video_id: video.id,
        progress: (video as any).progress ?? 0,
      },
    });
  } catch (err: any) {
    console.error("❌ /api/video-jobs error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
