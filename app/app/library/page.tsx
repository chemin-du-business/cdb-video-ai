"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type VideoJob = {
  id: string;
  status: "queued" | "processing" | "done" | "failed";
  progress: number | null;
  user_prompt: string | null;
  prompt_final: string | null;
  created_at: string;
  result_video_url: string | null;
  error_message: string | null;
};

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

/**
 * ✅ Téléchargement "direct" (sans ouvrir un nouvel onglet)
 * - Fetch en blob + lien temporaire + click programmatique
 * - Fallback: ouvre l'URL si le fetch est bloqué (CORS / Safari)
 */
async function downloadDirect(url: string, filename = "video.mp4") {
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  } catch {
    // fallback (au cas où le storage ne permet pas le fetch cross-origin)
    window.open(url, "_blank", "noreferrer");
  }
}

export default function LibraryPage() {
  const router = useRouter();

  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const jobsRef = useRef<VideoJob[]>([]);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const jobsSorted = useMemo(() => {
    return [...jobs].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [jobs]);

  const loadJobsSilent = async () => {
    const { data, error } = await supabase
      .from("video_jobs")
      .select(
        "id,status,progress,user_prompt,prompt_final,created_at,result_video_url,error_message"
      )
      .order("created_at", { ascending: false })
      .limit(60);

    if (!error && data) setJobs(data as VideoJob[]);
  };

  const loadJobsInitial = async () => {
    setLoading(true);
    await loadJobsSilent();
    setLoading(false);
  };

  const refreshAll = async (opts?: { force?: boolean }) => {
    const force = Boolean(opts?.force);

    const pendingLocal = jobsRef.current.some(
      (j) =>
        (j.status === "queued" || j.status === "processing") &&
        !j.result_video_url
    );

    if (!force && !pendingLocal) {
      await loadJobsSilent();
      return;
    }

    setRefreshing(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        await loadJobsSilent();
        return;
      }

      const idsToRefresh = jobsRef.current
        .filter(
          (j) =>
            (j.status === "queued" || j.status === "processing") &&
            !j.result_video_url
        )
        .map((j) => j.id);

      if (idsToRefresh.length > 0) {
        await Promise.all(
          idsToRefresh.map((id) =>
            fetch(`/api/video-jobs/${id}/refresh`, {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}` },
            }).catch(() => null)
          )
        );
      }

      await loadJobsSilent();
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * ✅ helper : reload + scroll top + refresh immédiat
   */
  const onJobCreatedNow = async () => {
    await loadJobsSilent();

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    await refreshAll({ force: true });
  };

  /**
   * ✅ refresh immédiat au mount
   */
  useEffect(() => {
    loadJobsInitial().then(() => refreshAll({ force: true }));

    const t = setInterval(() => {
      const pending = jobsRef.current.some(
        (j) =>
          (j.status === "queued" || j.status === "processing") &&
          !j.result_video_url
      );
      if (pending) refreshAll();
    }, 6000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Chargement…</div>;

  return (
    <main style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, margin: 0, letterSpacing: -0.6 }}>
            Bibliothèque
          </h1>
          <div style={{ opacity: 0.7, marginTop: 6 }}>
            Toutes tes vidéos (terminées + en cours).
          </div>
        </div>

        <button
          onClick={() => refreshAll({ force: true })}
          disabled={refreshing}
          style={{
            padding: "10px 14px",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "#111",
            color: "#fff",
            cursor: refreshing ? "not-allowed" : "pointer",
            fontWeight: 900,
          }}
        >
          {refreshing ? "Actualisation…" : "Actualiser"}
        </button>
      </div>

      {jobsSorted.length === 0 ? (
        <div style={{ opacity: 0.7 }}>Aucune vidéo pour le moment.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {jobsSorted.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onNoCredits={() => router.push("/app/credits")}
              onJobCreated={onJobCreatedNow}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function JobCard({
  job,
  onNoCredits,
  onJobCreated,
}: {
  job: VideoJob;
  onNoCredits: () => void;
  onJobCreated: () => Promise<void>;
}) {
  const title = (job.user_prompt || job.prompt_final || "Vidéo").trim();
  const isDone = job.status === "done";
  const isFailed = job.status === "failed";
  const isRunning = job.status === "processing" || job.status === "queued";
  const progress = Math.max(0, Math.min(100, Number(job.progress ?? 0)));

  const canShowVideo = Boolean(job.result_video_url);

  // ✅ Remix UI (inline)
  const [showRemix, setShowRemix] = useState(false);
  const [remixPrompt, setRemixPrompt] = useState("");
  const [remixSubmitting, setRemixSubmitting] = useState(false);

  const canRemix = canShowVideo && isDone && !isFailed;

  const submitRemix = async () => {
    if (!remixPrompt.trim()) {
      alert("Ajoute une consigne (prompt) pour le remix.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      alert("Session expirée, merci de te reconnecter.");
      return;
    }

    setRemixSubmitting(true);
    try {
      const res = await fetch(`/api/video-jobs/${job.id}/remix`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prompt: remixPrompt }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 402) {
        alert(data.error || "Plus de crédits.");
        onNoCredits();
        return;
      }

      if (!res.ok) {
        alert(data.error || "Erreur lors du remix");
        return;
      }

      await onJobCreated();

      setRemixPrompt("");
      setShowRemix(false);
    } finally {
      setRemixSubmitting(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 18,
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 6px 18px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "9 / 16",
          background: "#f2f2f2",
        }}
      >
        {canShowVideo ? (
          <VideoPreview url={job.result_video_url!} />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 8,
              color: "rgba(0,0,0,0.65)",
              fontWeight: 700,
            }}
          >
            {isFailed ? "❌ Erreur" : isDone ? "✅ Terminé" : "⏳ En cours…"}
            <div style={{ fontWeight: 500, fontSize: 12, opacity: 0.8 }}>
              {isRunning ? `${progress}%` : ""}
            </div>
          </div>
        )}

        {isRunning && (
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 12,
              height: 8,
              borderRadius: 999,
              background: "rgba(255,255,255,0.55)",
              overflow: "hidden",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "rgba(0,0,0,0.7)",
              }}
            />
          </div>
        )}
      </div>

      <div style={{ padding: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 14, lineHeight: "18px" }}>
          {title.length > 68 ? title.slice(0, 68) + "…" : title}
        </div>

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
          {fmtDate(job.created_at)}
        </div>

        {isFailed && (
          <div style={{ marginTop: 10, fontSize: 12, color: "crimson" }}>
            {job.error_message || "Erreur lors de la génération"}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          {canShowVideo ? (
            <>
              <a
                href={job.result_video_url!}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.12)",
                  textDecoration: "none",
                  color: "#111",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                Ouvrir
              </a>

              {/* ✅ Télécharger direct */}
              <button
                onClick={() =>
                  downloadDirect(
                    job.result_video_url!,
                    `video-${job.id}.mp4`
                  )
                }
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(255,255,255,0.95)",
                  color: "#111",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Télécharger
              </button>

              <button
                onClick={() => setShowRemix((v) => !v)}
                disabled={!canRemix}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: canRemix
                    ? "rgba(0,0,0,0.88)"
                    : "rgba(0,0,0,0.18)",
                  color: "#fff",
                  cursor: canRemix ? "pointer" : "not-allowed",
                  fontWeight: 800,
                  fontSize: 13,
                }}
                title="Coûte 1 crédit (débité à la réussite)"
              >
                Remixer
              </button>
            </>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {isDone
                ? "Terminé, mais aucun lien vidéo n’a été enregistré."
                : "Génération en cours…"}
            </div>
          )}
        </div>

        {showRemix && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.10)",
              background: "rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 13 }}>
              Remix
            </div>
            <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>
              Ajoute des consignes pour transformer cette vidéo.
            </div>

            <textarea
              value={remixPrompt}
              onChange={(e) => setRemixPrompt(e.target.value)}
              rows={3}
              placeholder="Ex: Ton plus dynamique, ajoute un appel à l’action, change le produit présenté…"
              style={{
                width: "100%",
                marginTop: 10,
                padding: 10,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                outline: "none",
                fontSize: 13,
                lineHeight: 1.4,
                background: "rgba(255,255,255,0.95)",
              }}
            />

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={submitRemix}
                disabled={remixSubmitting}
                style={{
                  padding: "9px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(0,0,0,0.88)",
                  color: "#fff",
                  cursor: remixSubmitting ? "not-allowed" : "pointer",
                  fontWeight: 900,
                  fontSize: 13,
                }}
              >
                {remixSubmitting ? "Remix en cours…" : "Lancer le remix"}
              </button>

              <button
                onClick={() => setShowRemix(false)}
                disabled={remixSubmitting}
                style={{
                  padding: "9px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(255,255,255,0.95)",
                  cursor: remixSubmitting ? "not-allowed" : "pointer",
                  fontWeight: 900,
                  fontSize: 13,
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ✅ Play button "vrai" (SVG) -> pas d’emoji sur iOS
 * + garde l’overlay comme sur desktop
 */
function VideoPreview({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(0,0,0,0.06), rgba(0,0,0,0.12))",
          }}
        />
      )}

      <video
        ref={videoRef}
        src={url}
        preload="auto"
        playsInline
        controls={playing}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
        onLoadedData={() => setReady(true)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      {!playing && (
        <button
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            v.play().catch(() => null);
            setPlaying(true);
          }}
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.06), rgba(0,0,0,0.25))",
            border: "none",
            cursor: "pointer",
          }}
          aria-label="Lire la vidéo"
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: "rgba(0,0,0,0.65)",
              display: "grid",
              placeItems: "center",
            }}
          >
            {/* ✅ SVG (pas d'emoji) */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M8 5v14l11-7z" fill="#fff" />
            </svg>
          </div>
        </button>
      )}
    </div>
  );
}
