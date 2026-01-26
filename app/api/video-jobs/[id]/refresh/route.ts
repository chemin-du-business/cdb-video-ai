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

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
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

  // ✅ Déjà terminé (URL déjà là)
  if ((job.status === "done" || job.status === "completed") && job.result_video_url) {
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
  const v = await openai.videos.retrieve(job.provider_video_id);
  const oaStatus = (v as any).status;
  const oaProgress = Number((v as any).progress ?? 0);

  console.log("OpenAI retrieve status:", oaStatus, "progress:", oaProgress);

  const newStatus =
    oaStatus === "completed"
      ? "done"
      : oaStatus === "failed"
      ? "failed"
      : "processing";

  // ✅ failed => on marque failed et on ne débite rien
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

  // ✅ DONE : finalisation + débit safe
  if (newStatus === "done") {
    // Re-check DB (important) : si un autre worker a déjà finalisé entre temps -> stop
    const { data: latest, error: latestErr } = await supabase
      .from("video_jobs")
      .select("result_video_url,status")
      .eq("id", job.id)
      .maybeSingle();

    if (latestErr) {
      console.error("❌ latest job read error:", latestErr);
      // On continue quand même (MVP)
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
      const msg = `OpenAI /content download failed: ${contentRes.status} ${txt}`.slice(0, 500);

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
      await supabase
        .from("video_jobs")
        .update({ status: "failed", error_message: upload.error.message })
        .eq("id", job.id);

      return json({ error: upload.error.message }, { status: 500 });
    }

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generated-videos/${path}`;

    /**
     * ✅ Soft lock sans status:
     * On écrit result_video_url SEULEMENT si elle est encore NULL.
     * Si un autre refresh l'a déjà mise, on ne refait rien.
     */
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
      // quelqu'un a déjà finalisé (result_video_url plus null)
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

    /**
     * =====================================================
     * ✅ DÉBIT SAFE (ANTI DOUBLE-DEBIT)
     * 1) insert ledger (protégé par unique index job_id delta<0)
     * 2) si insert OK => update profiles
     * =====================================================
     */
    const cost = Math.max(1, Number(job.cost_credits ?? 1));
    const reason = job.job_type === "remix" ? "video_remix_done" : "video_done";

    const led = await supabase.from("credit_ledger").insert({
      user_id: job.user_id,
      delta: -cost,
      reason,
      job_id: job.id,
    });

    if (led.error) {
      const code = (led.error as any)?.code;

      if (code === "23505") {
        // déjà débité -> surtout ne PAS toucher profile
        return json({
          status: "done",
          result_video_url: publicUrl,
          progress: 100,
          charged: true,
          already_charged: true,
          cost_credits: cost,
        });
      }

      console.error("❌ ledger insert error:", led.error);
      return json({
        status: "done",
        result_video_url: publicUrl,
        progress: 100,
        charged: false,
        warning: led.error.message,
      });
    }

    // Décrément profile seulement si ledger OK
    const prof = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", job.user_id)
      .maybeSingle();

    if (prof.error) {
      console.error("❌ profile read error:", prof.error);
      return json({
        status: "done",
        result_video_url: publicUrl,
        progress: 100,
        charged: true,
        cost_credits: cost,
        warning: prof.error.message,
      });
    }

    const currentCredits = Number(prof.data?.credits ?? 0);
    const nextCredits = Math.max(0, currentCredits - cost);

    const dec = await supabase
      .from("profiles")
      .update({ credits: nextCredits })
      .eq("id", job.user_id);

    if (dec.error) {
      console.error("❌ profile debit error:", dec.error);
      return json({
        status: "done",
        result_video_url: publicUrl,
        progress: 100,
        charged: true,
        cost_credits: cost,
        warning: dec.error.message,
      });
    }

    return json({
      status: "done",
      result_video_url: publicUrl,
      progress: 100,
      charged: true,
      cost_credits: cost,
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
