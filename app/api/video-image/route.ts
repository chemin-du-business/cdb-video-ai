// /app/api/video-image/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

// ✅ IMPORTANT : l'image doit matcher EXACTEMENT la size demandée à Sora
const VIDEO_SIZE = "720x1280";
const TARGET_WIDTH = 720;
const TARGET_HEIGHT = 1280;

function isInsufficientCreditsError(message?: string) {
  const m = (message ?? "").toUpperCase();
  return m.includes("INSUFFICIENT_CREDITS");
}

function safeErrorMessage(err: any) {
  return (
    err?.error?.message ||
    err?.message ||
    (typeof err === "string" ? err : "Unknown provider error")
  );
}

export async function POST(req: Request) {
  try {
    /* ---------------- AUTH ---------------- */
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

    /* ---------------- FORM DATA ---------------- */
    const formData = await req.formData();
    const prompt = String(formData.get("prompt") ?? "").trim();
    const image = formData.get("image");

    if (!prompt) {
      return NextResponse.json({ error: "prompt requis" }, { status: 400 });
    }

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "image requise" }, { status: 400 });
    }

    /* ---------------- IMAGE NORMALIZATION ----------------
       ✅ Sans rogner => fit: contain + fond blanc
       ✅ Orientation OK => rotate() lit EXIF
       ✅ Taille EXACTE 720x1280 (doit matcher size)
    */
    const inputBuffer = Buffer.from(await image.arrayBuffer());

    let normalizedBuffer: Buffer;
    try {
      normalizedBuffer = await sharp(inputBuffer)
        .rotate() // ✅ corrige les photos iPhone (EXIF)
        .resize(TARGET_WIDTH, TARGET_HEIGHT, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();
    } catch (e: any) {
      console.error("❌ sharp normalize failed:", e);
      return NextResponse.json({ error: "Image invalide ou illisible" }, { status: 400 });
    }

    // File (Node 18+) OK pour l'API OpenAI
    const normalizedImage = new File([new Uint8Array(normalizedBuffer)], "input.jpg", {
      type: "image/jpeg",
    });

    /* ---------------- CREATE JOB ----------------
       ✅ status queued => trigger DB débite (ou throw INSUFFICIENT_CREDITS)
    */
    const { data: job, error: jobErr } = await supabase
      .from("video_jobs")
      .insert({
        user_id: user.id,
        template_id: null,
        user_prompt: prompt,
        prompt_final: prompt,
        status: "queued",
        provider: "openai",
        progress: 0,
        job_type: "generate",
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

    /* ---------------- SORA CALL ---------------- */
    let video: any;
    try {
      video = await openai.videos.create({
        model: "sora-2-pro",
        prompt,
        input_reference: normalizedImage,
        seconds: "12",
        size: VIDEO_SIZE, // ✅ 720x1280
      });
    } catch (err: any) {
      const msg = safeErrorMessage(err);
      console.error("❌ Sora create failed:", msg, err);

      // ✅ failed => trigger DB refund
      await supabase
        .from("video_jobs")
        .update({
          status: "failed",
          error_message: msg,
        })
        .eq("id", job.id);

      return NextResponse.json(
        { error: "Failed to create video with provider", details: msg },
        { status: 500 }
      );
    }

    /* ---------------- UPDATE JOB ---------------- */
    const { error: updErr } = await supabase
      .from("video_jobs")
      .update({
        provider_video_id: video.id,
        status: "processing",
        progress: Number((video as any).progress ?? 0),
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
        progress: Number((video as any).progress ?? 0),
      },
    });
  } catch (err: any) {
    console.error("❌ /api/video-image error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
