// /app/api/video-jobs/[id]/refresh/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("❌ SUPABASE_SERVICE_ROLE_KEY manquante");
}
if (!process.env.OPENAI_API_KEY) {
  throw new Error("❌ OPENAI_API_KEY manquante");
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("❌ NEXT_PUBLIC_SUPABASE_URL manquante");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const NO_STORE = { headers: { "Cache-Control": "no-store" } };
function json(body: any, init?: Parameters<typeof NextResponse.json>[1]) {
  return NextResponse.json(body, { ...(init ?? {}), ...NO_STORE });
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await context.params;

  console.log("🔁 REFRESH JOB", jobId);

  const { data: job, error } = await supabase
    .from("video_jobs")
    .select(
      "id, user_id, status, provider_video_id, result_video_url, error_message, progress, cost_credits, job_type"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    console.error("❌ DB error in refresh:", error);
    return json({ error: error.message }, { status: 500 });
  }
  if (!job) {
    return json({ error: "Job not found" }, { status: 404 });
  }

  // ✅ Déjà terminé
  if (job.status === "done" && job.result_video_url) {
    return json({
      status: "done",
      result_video_url: job.result_video_url,
      progress: 100,
    });
  }

  // Pas encore lancé côté provider
  if (!job.provider_video_id) {
    return json({
      status: job.status ?? "queued",
      progress: job.progress ?? 0,
    });
  }

  // Statut OpenAI
  let v: any;
  try {
    v = await openai.videos.retrieve(job.provider_video_id);
  } catch (e: any) {
    // Si retrieve casse, on n'échoue pas forcément le job : on renvoie processing
    console.error("❌ OpenAI retrieve failed:", e);
    return json({
      status: job.status ?? "processing",
      progress: job.progress ?? 0,
      warning: e?.message ?? "OpenAI retrieve failed",
    });
  }

  const oaStatus = (v as any).status;
  const oaProgress = Number((v as any).progress ?? 0);

  console.log("OpenAI retrieve status:", oaStatus, "progress:", oaProgress);

  const newStatus =
    oaStatus === "completed"
      ? "done"
      : oaStatus === "failed"
      ? "failed"
      : "processing";

  // ✅ failed => on marque failed (le trigger DB rembourse automatiquement)
  if (newStatus === "failed") {
    await supabase
      .from("video_jobs")
      .update({
        status: "failed",
        progress: oaProgress,
        error_message: (v as any).error?.message ?? "OpenAI generation failed",
      })
      .eq("id", job.id);

    return json({ status: "failed", progress: oaProgress });
  }

  // ✅ DONE : finalisation (⚠️ PLUS AUCUN DÉBIT ICI)
  if (newStatus === "done") {
    // si déjà finalisé entre temps
    const { data: latest, error: latestErr } = await supabase
      .from("video_jobs")
      .select("result_video_url,status")
      .eq("id", job.id)
      .maybeSingle();

    if (latestErr) {
      console.error("❌ latest job read error:", latestErr);
      // on continue
    } else if (latest?.result_video_url) {
      return json({
        status: "done",
        result_video_url: latest.result_video_url,
        progress: 100,
        already_finalized: true,
      });
    }

    console.log("🎉 VIDEO DONE — downloading via /content");

    const contentRes = await fetch(
      `https://api.openai.com/v1/videos/${job.provider_video_id}/content`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    if (!contentRes.ok) {
      const txt = await contentRes.text().catch(() => "");
      const msg = `OpenAI /content download failed: ${contentRes.status} ${txt}`.slice(
        0,
        500
      );

      // failed => trigger DB refund
      await supabase
        .from("video_jobs")
        .update({ status: "failed", error_message: msg })
        .eq("id", job.id);

      return json({ error: msg }, { status: 500 });
    }

    const arrayBuffer = await contentRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const path = `${job.user_id}/${job.id}.mp4`;

    const upload = await supabase.storage
      .from("generated-videos")
      .upload(path, buffer, { contentType: "video/mp4", upsert: true });

    if (upload.error) {
      // failed => trigger DB refund
      await supabase
        .from("video_jobs")
        .update({ status: "failed", error_message: upload.error.message })
        .eq("id", job.id);

      return json({ error: upload.error.message }, { status: 500 });
    }

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generated-videos/${path}`;

    // Soft lock : écrit result_video_url seulement si NULL
    const updDone = await supabase
      .from("video_jobs")
      .update({
        status: "done",
        result_video_url: publicUrl,
        progress: 100,
      })
      .eq("id", job.id)
      .is("result_video_url", null)
      .select("result_video_url")
      .maybeSingle();

    if (updDone.error) {
      return json({ error: updDone.error.message }, { status: 500 });
    }

    if (!updDone.data) {
      const { data: latest2 } = await supabase
        .from("video_jobs")
        .select("result_video_url")
        .eq("id", job.id)
        .maybeSingle();

      return json({
        status: "done",
        result_video_url: latest2?.result_video_url ?? publicUrl,
        progress: 100,
        already_finalized: true,
      });
    }

    // ✅ plus de débit ici (déjà fait au lancement du job)
    return json({
      status: "done",
      result_video_url: publicUrl,
      progress: 100,
      charged: true, // indicatif : débité au lancement
      cost_credits: Math.max(1, Number(job.cost_credits ?? 1)),
    });
  }

  // ✅ En cours : update status/progress
  await supabase
    .from("video_jobs")
    .update({ status: newStatus, progress: oaProgress })
    .eq("id", job.id);

  return json({
    status: newStatus,
    progress: oaProgress,
  });
}
