"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Job = {
  id: string;
  status: string;
  result_video_url: string | null;
  progress: number | null;
};

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);

  // 1) Charge job depuis DB
  const loadJob = async () => {
    const { data } = await supabase
      .from("video_jobs")
      .select("id, status, result_video_url, progress")
      .eq("id", id)
      .single();

    if (data) setJob(data);
  };

  // 2) Poll backend refresh (qui poll OpenAI)
  const refresh = async () => {
    await fetch(`/api/video-jobs/${id}/refresh`, { method: "POST" });
    await loadJob();
  };

  useEffect(() => {
    loadJob();

    const t = setInterval(() => {
      refresh();
    }, 3000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!job) return <main style={{ padding: 24 }}><p>Chargement…</p></main>;

  return (
    <main style={{ padding: 24 }}>
      <h1>Génération de la vidéo</h1>

      {job.status !== "done" && (
        <p>
          {job.status === "queued" && "⏳ En attente…"}
          {job.status === "processing" && `⚙️ Génération en cours… (${job.progress ?? 0}%)`}
          {job.status === "failed" && "❌ Erreur lors de la génération"}
        </p>
      )}

      {job.status === "done" && job.result_video_url && (
        <>
          <p>✅ Vidéo prête !</p>
          <video src={job.result_video_url} controls style={{ width: "100%", maxWidth: 720 }} />
          <p style={{ marginTop: 12 }}>
            <a href={job.result_video_url} download>
              Télécharger la vidéo
            </a>
          </p>
        </>
      )}
    </main>
  );
}
