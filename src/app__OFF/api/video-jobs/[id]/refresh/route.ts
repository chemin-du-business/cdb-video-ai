import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await context.params;

  const { data: job } = await supabase
    .from("video_jobs")
    .select("id, user_id, status, provider_video_id, result_video_url")
    .eq("id", jobId)
    .single();

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!job.provider_video_id)
    return NextResponse.json({ error: "No provider_video_id" }, { status: 400 });

  // Si déjà done, rien à faire
  if (job.status === "done" && job.result_video_url) {
    return NextResponse.json({ status: job.status, result_video_url: job.result_video_url });
  }

  // 1) Statut OpenAI
  const v = await openai.videos.retrieve(job.provider_video_id);

  const newStatus =
    v.status === "completed" ? "done" :
    v.status === "failed" ? "failed" :
    "processing";

  // 2) Si terminé -> récupérer le mp4 et l'uploader
  if (newStatus === "done") {
    const content = await openai.videos.content(job.provider_video_id);
    const arrayBuffer = await content.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const path = `${job.user_id}/${job.id}.mp4`;

    const upload = await supabase.storage
      .from("generated-videos")
      .upload(path, buffer, { contentType: "video/mp4", upsert: true });

    if (upload.error) {
      await supabase
        .from("video_jobs")
        .update({ status: "failed", error_message: upload.error.message })
        .eq("id", job.id);

      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generated-videos/${path}`;

    await supabase
      .from("video_jobs")
      .update({ status: "done", result_video_url: publicUrl, progress: 100 })
      .eq("id", job.id);

    return NextResponse.json({ status: "done", result_video_url: publicUrl });
  }

  // 3) Sinon update progress + status
  await supabase
    .from("video_jobs")
    .update({ status: newStatus, progress: v.progress ?? 0 })
    .eq("id", job.id);

  return NextResponse.json({ status: newStatus, progress: v.progress ?? 0 });
}
