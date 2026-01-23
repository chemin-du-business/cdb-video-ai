import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { template_id, user_prompt } = await req.json();

    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    const user = userData?.user;

    if (!user || authError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1) Vérifier crédits
    const { data: profile } = await supabase.from("profiles").select("credits").eq("id", user.id).single();
    if (!profile || profile.credits <= 0) {
      return NextResponse.json({ error: "No credits available" }, { status: 402 });
    }

    // 2) Récupérer template (pour construire prompt_final)
    const { data: tpl, error: tplErr } = await supabase
      .from("templates")
      .select("prompt_prefix, prompt_suffix, format, duration_seconds")
      .eq("id", template_id)
      .single();

    if (tplErr || !tpl) return NextResponse.json({ error: "Template not found" }, { status: 400 });

    const prompt_final = `${tpl.prompt_prefix} ${user_prompt} ${tpl.prompt_suffix ?? ""}`.trim();

    // 3) Dépenser 1 crédit
    await supabase.from("profiles").update({ credits: profile.credits - 1 }).eq("id", user.id);

    // 4) Créer job local
    const { data: job, error: jobErr } = await supabase
      .from("video_jobs")
      .insert({
        user_id: user.id,
        template_id,
        user_prompt,
        prompt_final,
        status: "queued",
        provider: "openai",
      })
      .select()
      .single();

    if (jobErr || !job) return NextResponse.json({ error: jobErr?.message ?? "Job error" }, { status: 500 });

    // 5) Lancer Sora 2 (async côté OpenAI)
    // Sora est asynchrone: POST /v1/videos -> renvoie un job id et status queued. :contentReference[oaicite:2]{index=2}
    const video = await openai.videos.create({
      model: "sora-2",
      prompt: prompt_final,
      seconds: "12",
      size: "720x1280",
    });

    // 6) Sauver l'id OpenAI + passer en processing
    await supabase
      .from("video_jobs")
      .update({
        provider_video_id: video.id,
        status: "processing",
        progress: video.progress ?? 0,
      })
      .eq("id", job.id);

    return NextResponse.json({ job: { ...job, provider_video_id: video.id, status: "processing" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
