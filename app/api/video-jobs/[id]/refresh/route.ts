import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // ✅ Déjà terminé (done) + url dispo => on ne fait rien
  if ((job.status === "done" || job.status === "completed") && job.result_video_url) {
    return NextResponse.json({
      status: "done",
      result_video_url: job.result_video_url,
      progress: 100,
    });
  }

  // Pas encore lancé côté provider
  if (!job.provider_video_id) {
    return NextResponse.json({
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

  // ✅ Si failed côté OpenAI => on marque failed et on ne débite rien
  if (newStatus === "failed") {
    await supabase
      .from("video_jobs")
      .update({
        status: "failed",
        progress: oaProgress,
        error_message: (v as any).error?.message ?? "OpenAI generation failed",
      })
      .eq("id", job.id);

    return NextResponse.json({
      status: "failed",
      progress: oaProgress,
    });
  }

  // ✅ Si terminé : télécharger MP4 + upload + set result_video_url + débiter 1 seule fois
  if (newStatus === "done") {
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

      await supabase
        .from("video_jobs")
        .update({ status: "failed", error_message: msg })
        .eq("id", job.id);

      return NextResponse.json({ error: msg }, { status: 500 });
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

      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generated-videos/${path}`;

    // 1) On met à jour le job (done + url)
    const updDone = await supabase
      .from("video_jobs")
      .update({
        status: "done",
        result_video_url: publicUrl,
        progress: 100,
      })
      .eq("id", job.id);

    if (updDone.error) {
      return NextResponse.json({ error: updDone.error.message }, { status: 500 });
    }

    /**
     * =====================================================
     * ✅ DÉBIT DU CRÉDIT (UNIQUEMENT SI DONE) + 1 SEULE FOIS
     * Idempotence basée sur credit_ledger (job_id)
     * =====================================================
     */
    const cost = Math.max(1, Number(job.cost_credits ?? 1));

    // A) si déjà débité => on ne fait rien
    const { data: existingDebit, error: debitCheckErr } = await supabase
      .from("credit_ledger")
      .select("id")
      .eq("job_id", job.id)
      .lt("delta", 0) // delta négatif = débit
      .maybeSingle();

    if (debitCheckErr) {
      console.error("❌ debit check error:", debitCheckErr);
      // On ne bloque pas : vidéo OK
      return NextResponse.json({
        status: "done",
        result_video_url: publicUrl,
        progress: 100,
        charged: false,
        warning: debitCheckErr.message,
      });
    }

    if (existingDebit?.id) {
      // déjà débité
      return NextResponse.json({
        status: "done",
        result_video_url: publicUrl,
        progress: 100,
        charged: true,
        already_charged: true,
      });
    }

    // B) lire crédits actuels
    const prof = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", job.user_id)
      .maybeSingle();

    if (prof.error) {
      console.error("❌ profile read error:", prof.error);
      return NextResponse.json({
        status: "done",
        result_video_url: publicUrl,
        progress: 100,
        charged: false,
        warning: prof.error.message,
      });
    }

    const currentCredits = Number(prof.data?.credits ?? 0);
    const nextCredits = Math.max(0, currentCredits - cost);

    // C) update crédits
    const dec = await supabase
      .from("profiles")
      .update({ credits: nextCredits })
      .eq("id", job.user_id);

    if (dec.error) {
      console.error("❌ profile debit error:", dec.error);
      return NextResponse.json({
        status: "done",
        result_video_url: publicUrl,
        progress: 100,
        charged: false,
        warning: dec.error.message,
      });
    }

    // D) ledger (delta négatif)
    const reason =
      job.job_type === "remix" ? "video_remix_done" : "video_done";

    const led = await supabase.from("credit_ledger").insert({
      user_id: job.user_id,
      delta: -cost,
      reason,
      job_id: job.id,
    });

    if (led.error) {
      console.error("❌ ledger insert error:", led.error);
      // MVP: on ne rollback pas, mais tu peux monitorer via logs
    }

    return NextResponse.json({
      status: "done",
      result_video_url: publicUrl,
      progress: 100,
      charged: true,
      cost_credits: cost,
    });
  }

  // ✅ Toujours en cours : update DB
  await supabase
    .from("video_jobs")
    .update({ status: newStatus, progress: oaProgress })
    .eq("id", job.id);

  return NextResponse.json({
    status: newStatus,
    progress: oaProgress,
  });
}
