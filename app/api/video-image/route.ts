import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("❌ OPENAI_API_KEY manquante");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("❌ SUPABASE_SERVICE_ROLE_KEY manquante");
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("❌ NEXT_PUBLIC_SUPABASE_URL manquante");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TARGET_WIDTH = 1024;
const TARGET_HEIGHT = 1792;

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

    /* ---------------- IMAGE NORMALIZATION ---------------- */
    const inputBuffer = Buffer.from(await image.arrayBuffer());

    // Resize proportionnel + padding BLANC (aucune coupe)
    const normalizedBuffer = await sharp(inputBuffer)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: "contain",
        background: {
          r: 255,
          g: 255,
          b: 255,
        },
      })
      .jpeg({ quality: 92 })
      .toBuffer();

    // ✅ Fix TS/Vercel: Buffer -> Uint8Array pour être compatible BlobPart
    const normalizedImage = new File([new Uint8Array(normalizedBuffer)], "input.jpg", {
      type: "image/jpeg",
    });

    /* ---------------- CREATE JOB ---------------- */
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
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      console.error("❌ Job insert error:", jobErr);
      return NextResponse.json(
        { error: jobErr?.message ?? "Failed to create job" },
        { status: 500 }
      );
    }

    /* ---------------- SORA CALL ---------------- */
    const video = await openai.videos.create({
      model: "sora-2-pro",
      prompt,
      input_reference: normalizedImage,
      seconds: "12",
      size: "1024x1792",
    });

    /* ---------------- UPDATE JOB ---------------- */
    await supabase
      .from("video_jobs")
      .update({
        provider_video_id: video.id,
        status: "processing",
        progress: (video as any).progress ?? 0,
      })
      .eq("id", job.id);

    return NextResponse.json({
      job: {
        id: job.id,
        status: "processing",
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
