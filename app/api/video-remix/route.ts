import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { template_id, user_prompt } = await req.json();

    if (!template_id) return NextResponse.json({ error: "template_id requis" }, { status: 400 });
    if (!user_prompt || !String(user_prompt).trim()) {
      return NextResponse.json({ error: "user_prompt requis" }, { status: 400 });
    }

    // auth user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (authErr || !user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    // load template + source video id
    const { data: tpl, error: tplErr } = await supabase
      .from("templates")
      .select("template_video_id, prompt_prefix, prompt_suffix")
      .eq("id", template_id)
      .maybeSingle();

    if (tplErr) return NextResponse.json({ error: tplErr.message }, { status: 500 });
    if (!tpl) return NextResponse.json({ error: "Template introuvable" }, { status: 400 });
    if (!tpl.template_video_id) {
      return NextResponse.json({ error: "template_video_id manquant sur ce template" }, { status: 400 });
    }

    // prompt remix
    const prompt_final = `${tpl.prompt_prefix ?? ""} ${user_prompt} ${tpl.prompt_suffix ?? ""}`.trim();

    // create job DB
    const { data: job, error: jobErr } = await supabase
      .from("video_jobs")
      .insert({
        user_id: user.id,
        template_id,
        user_prompt: String(user_prompt).trim(),
        prompt_final,
        status: "queued",
        provider: "openai",
        progress: 0,
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: jobErr?.message ?? "Failed to create job" }, { status: 500 });
    }

    // ✅ official remix endpoint: POST /videos/{video_id}/remix :contentReference[oaicite:3]{index=3}
    const remix = await openai.videos.remix(tpl.template_video_id, {
      prompt: prompt_final,
    });

    // update job
    await supabase
      .from("video_jobs")
      .update({
        provider_video_id: remix.id,
        status: "processing",
        progress: (remix as any).progress ?? 0,
      })
      .eq("id", job.id);

    return NextResponse.json({ job: { id: job.id, status: "processing" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
