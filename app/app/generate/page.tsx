"use client";

import { supabase } from "@/lib/supabaseClient";
import { useCredits } from "@/lib/useCredits";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "text" | "remix" | "image";

type Template = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  preview_video_url: string | null;
  template_video_id: string | null; // gardé côté data, mais on ne l'affiche plus dans l'UI
};

function Card({
  children,
  selected,
}: {
  children: React.ReactNode;
  selected?: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: selected
          ? "2px solid rgba(0,0,0,0.85)"
          : "1px solid rgba(0,0,0,0.12)",
        overflow: "hidden",
        background: "rgba(255,255,255,0.9)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
        transition: "transform 120ms ease, box-shadow 120ms ease",
      }}
    >
      {children}
    </div>
  );
}

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 999,
        border: active
          ? "1px solid rgba(0,0,0,0.85)"
          : "1px solid rgba(0,0,0,0.15)",
        background: active ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)",
        color: active ? "white" : "rgba(0,0,0,0.85)",
        cursor: "pointer",
        fontWeight: 800,
        letterSpacing: 0.2,
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}

export default function CreatePage() {
  const router = useRouter();
  const { credits, loading: creditsLoading } = useCredits();

  const [tab, setTab] = useState<Tab>("text");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Remix tab
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // ✅ AUCUNE sélection par défaut
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );

  // Categories pills
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Image tab
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const canGenerate = !creditsLoading && (credits ?? 0) > 0 && !submitting;

  useEffect(() => {
    const loadTemplates = async () => {
      setTemplatesLoading(true);
      const { data, error } = await supabase
        .from("templates")
        .select(
          "id, name, description, category, preview_video_url, template_video_id"
        )
        .eq("is_active", true)
        .order("position", { ascending: true });

      if (!error && data) setTemplates(data as Template[]);
      setTemplatesLoading(false);
    };

    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    let hasUncategorized = false;

    for (const t of templates) {
      const c = (t.category ?? "").trim();
      if (!c) hasUncategorized = true;
      else set.add(c);
    }

    const realCats = Array.from(set).sort((a, b) => a.localeCompare(b));
    const out = ["all"];
    if (hasUncategorized) out.push("uncategorized");
    out.push(...realCats);
    return out;
  }, [templates]);

  const templatesFiltered = useMemo(() => {
    if (selectedCategory === "all") return templates;
    if (selectedCategory === "uncategorized") {
      return templates.filter((t) => !(t.category ?? "").trim());
    }
    return templates.filter(
      (t) => (t.category ?? "").trim() === selectedCategory
    );
  }, [templates, selectedCategory]);

  // ✅ si on change de catégorie et que le template sélectionné n'est plus visible -> on désélectionne
  useEffect(() => {
    if (tab !== "remix") return;
    if (!selectedTemplateId) return;

    const stillVisible = templatesFiltered.some(
      (t) => t.id === selectedTemplateId
    );
    if (!stillVisible) setSelectedTemplateId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, templatesFiltered.length, tab]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const requireSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      alert("Session expirée, merci de te reconnecter.");
      router.push("/login");
      return null;
    }
    return session;
  };

  const handleNoCredits = (msg?: string) => {
    alert(msg || "Plus de crédits. Achète des crédits pour continuer.");
    router.push("/app/credits");
  };

  const runTextToVideo = async () => {
    if (!prompt.trim()) {
      alert("Merci de décrire ce que la personne doit présenter.");
      return;
    }

    const session = await requireSession();
    if (!session) return;

    setSubmitting(true);

    const res = await fetch("/api/video-jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ user_prompt: prompt }),
    });

    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (res.status === 402) return handleNoCredits(data.error);
    if (!res.ok) return alert(data.error || "Erreur lors de la création du job");

    router.push(`/app/library?jobCreated=${data.job.id}`);
  };

  const runTemplateRemix = async () => {
    if (!selectedTemplateId) {
      alert("Sélectionne un template.");
      return;
    }
    if (!prompt.trim()) {
      alert("Ajoute une consigne (prompt) pour le remix.");
      return;
    }

    const session = await requireSession();
    if (!session) return;

    setSubmitting(true);

    const res = await fetch("/api/video-remix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        template_id: selectedTemplateId,
        user_prompt: prompt,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (res.status === 402) return handleNoCredits(data.error);
    if (!res.ok)
      return alert(data.error || "Erreur lors de la création du remix");

    router.push(`/app/library?jobCreated=${data.job.id}`);
  };

  const runImageToVideo = async () => {
    if (!imageFile) {
      alert("Ajoute une image.");
      return;
    }
    if (!prompt.trim()) {
      alert("Ajoute un prompt (ce que doit raconter/faire la vidéo).");
      return;
    }

    const session = await requireSession();
    if (!session) return;

    setSubmitting(true);

    const form = new FormData();
    form.append("prompt", prompt);
    form.append("image", imageFile);

    const res = await fetch("/api/video-image", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: form,
    });

    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (res.status === 402) return handleNoCredits(data.error);
    if (!res.ok)
      return alert(data.error || "Erreur lors de la création (image → vidéo)");

    router.push(`/app/library?jobCreated=${data.job.id}`);
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;

    if (tab === "text") return runTextToVideo();
    if (tab === "remix") return runTemplateRemix();
    return runImageToVideo();
  };

  const primaryButtonLabel =
    submitting
      ? "Création en cours…"
      : tab === "text"
      ? "Générer (Texte → Vidéo)"
      : tab === "remix"
      ? "Remixer à partir du template"
      : "Générer (Image → Vidéo)";

  // ✅ AU CLICK SUR SELECT: scroll en bas de page
  const selectTemplateAndScrollToBottom = (id: string) => {
    setSelectedTemplateId(id);

    // petit délai pour laisser React rerender
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }, 80);
  };

  return (
    <main
      style={{
        minHeight: "calc(100vh - 40px)",
        padding: 24,
        background:
          "radial-gradient(1200px 600px at 10% 0%, rgba(0,0,0,0.06), transparent 60%), radial-gradient(1200px 600px at 90% 0%, rgba(0,0,0,0.05), transparent 55%)",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, margin: 0, letterSpacing: -0.6 }}>
              Créer une vidéo
            </h1>
            <p style={{ marginTop: 8, opacity: 0.75, maxWidth: 760 }}>
              Choisis un mode de génération. Tu peux générer depuis du texte,
              remixer un template vidéo, ou partir d’une image.
            </p>
          </div>

          <Card>
            <div
              style={{
                padding: 14,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(0,0,0,0.06)",
                }}
              >
                💳
              </div>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>
                  Mon solde
                </div>
                <div style={{ opacity: 0.8, marginTop: 2 }}>
                  {creditsLoading ? "Chargement…" : `${credits ?? 0} crédit(s)`}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 18,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <Pill active={tab === "text"} onClick={() => setTab("text")}>
            Texte → Vidéo
          </Pill>
          <Pill active={tab === "remix"} onClick={() => setTab("remix")}>
            Template Vidéo → Remix
          </Pill>
          <Pill active={tab === "image"} onClick={() => setTab("image")}>
            Image → Vidéo
          </Pill>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          <Card>
            <div style={{ padding: 18 }}>
              {tab === "remix" && (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>
                        Template
                      </div>
                      <div style={{ opacity: 0.75, marginTop: 4 }}>
                        Choisis un template, puis écris comment tu veux le
                        transformer (texte, ton, offre, cible).
                      </div>
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {templatesLoading
                        ? "Chargement…"
                        : `${templatesFiltered.length} template(s)`}
                    </div>
                  </div>

                  {/* Catégories en pills */}
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      marginTop: 12,
                    }}
                  >
                    {categories.map((c) => (
                      <Pill
                        key={c}
                        active={selectedCategory === c}
                        onClick={() => setSelectedCategory(c)}
                      >
                        {c === "all"
                          ? "Tous"
                          : c === "uncategorized"
                          ? "Autres"
                          : c}
                      </Pill>
                    ))}
                  </div>

                  <div className="templatesGrid">
                    {templatesLoading ? (
                      <div style={{ opacity: 0.8 }}>
                        Chargement des templates…
                      </div>
                    ) : templatesFiltered.length === 0 ? (
                      <div style={{ opacity: 0.8 }}>
                        Aucun template dans cette catégorie.
                      </div>
                    ) : (
                      templatesFiltered.map((t) => (
                        <TemplateCard
                          key={t.id}
                          t={t}
                          selected={t.id === selectedTemplateId}
                          onSelect={() => selectTemplateAndScrollToBottom(t.id)}
                        />
                      ))
                    )}
                  </div>

                  <div style={{ height: 14 }} />
                  <div style={{ height: 1, background: "rgba(0,0,0,0.08)" }} />
                  <div style={{ height: 14 }} />
                </>
              )}

              {tab === "image" && (
                <>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    Image source
                  </div>
                  <div style={{ opacity: 0.75, marginTop: 4 }}>
                    Ajoute une image, puis écris un prompt pour générer la vidéo
                    à partir de cette image.
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    <Card>
                      <div style={{ padding: 14 }}>
                        <div style={{ fontWeight: 800, marginBottom: 8 }}>
                          Choisir une image
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            setImageFile(f);
                            if (imagePreviewUrl)
                              URL.revokeObjectURL(imagePreviewUrl);
                            setImagePreviewUrl(
                              f ? URL.createObjectURL(f) : null
                            );
                          }}
                        />
                        <div
                          style={{
                            fontSize: 12,
                            opacity: 0.7,
                            marginTop: 8,
                          }}
                        >
                          JPG/PNG recommandé, bonne lumière, visage net.
                        </div>
                      </div>
                    </Card>

                    <Card>
                      <div style={{ padding: 14 }}>
                        <div style={{ fontWeight: 800, marginBottom: 8 }}>
                          Aperçu
                        </div>
                        {imagePreviewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imagePreviewUrl}
                            alt="preview"
                            style={{
                              width: "100%",
                              borderRadius: 14,
                              display: "block",
                            }}
                          />
                        ) : (
                          <div style={{ opacity: 0.75 }}>
                            Aucune image sélectionnée.
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>

                  <div style={{ height: 14 }} />
                  <div style={{ height: 1, background: "rgba(0,0,0,0.08)" }} />
                  <div style={{ height: 14 }} />
                </>
              )}

              <div style={{ fontWeight: 900, fontSize: 16 }}>
                Prompt{" "}
                {tab === "remix" && selectedTemplateId && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 12,
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "rgba(0,0,0,0.04)",
                      fontWeight: 900,
                    }}
                    title="Template sélectionné"
                  >
                    ✅ Template sélectionné
                  </span>
                )}
              </div>

              <div style={{ opacity: 0.75, marginTop: 4 }}>
                {tab === "text"
                  ? "Décris ce que la personne doit présenter. Génération 100% à partir du texte."
                  : tab === "remix"
                  ? "Ajoute des consignes pour transformer la vidéo template (remix)."
                  : "Explique ce que la vidéo doit raconter / présenter à partir de l’image."}
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={7}
                style={{
                  width: "100%",
                  marginTop: 12,
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.15)",
                  outline: "none",
                  fontSize: 14,
                  lineHeight: 1.5,
                  background: "rgba(255,255,255,0.95)",
                }}
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 14,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: canGenerate
                      ? "rgba(0,0,0,0.88)"
                      : "rgba(0,0,0,0.25)",
                    color: "white",
                    cursor: canGenerate ? "pointer" : "not-allowed",
                    fontWeight: 900,
                    letterSpacing: 0.2,
                    minWidth: 260,
                  }}
                >
                  {primaryButtonLabel}
                </button>

                <div style={{ fontSize: 13, opacity: 0.75 }}>
                  {tab === "text"
                    ? "Qualité: Sora 2 Pro (HD)"
                    : tab === "remix"
                    ? selectedTemplate
                      ? `Template sélectionné : ${selectedTemplate.name}`
                      : "Sélectionne un template"
                    : "Base: Image (input_reference)"}
                </div>
              </div>

              {tab === "remix" && !selectedTemplateId && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(0,0,0,0.04)",
                    border: "1px solid rgba(0,0,0,0.10)",
                    fontWeight: 800,
                    opacity: 0.9,
                  }}
                >
                  Sélectionne un template au-dessus pour débloquer le remix.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <style jsx>{`
        .templatesGrid {
          margin-top: 14px;
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        @media (max-width: 980px) {
          .templatesGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .templatesGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
        }
        @media (max-width: 360px) {
          .templatesGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function TemplateCard({
  t,
  selected,
  onSelect,
}: {
  t: Template;
  selected: boolean;
  onSelect: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [soundOn, setSoundOn] = useState(false);

  const setMuted = (muted: boolean) => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    v.volume = muted ? 0 : 1;
  };

  const toggleSoundMobile = async () => {
    const v = videoRef.current;
    if (!v) return;

    try {
      if (v.paused) await v.play();
    } catch {
      // ignore
    }

    setSoundOn((prev) => {
      const next = !prev;
      setMuted(!next);
      return next;
    });
  };

  return (
    <div className="tplCard">
      <Card selected={selected}>
        {t.preview_video_url ? (
          <div style={{ position: "relative" }}>
            <video
              ref={videoRef}
              src={t.preview_video_url}
              autoPlay
              loop
              muted={!soundOn}
              playsInline
              preload="metadata"
              style={{ width: "100%", display: "block" }}
              onMouseEnter={() => {
                setSoundOn(true);
                setMuted(false);
              }}
              onMouseLeave={() => {
                setSoundOn(false);
                setMuted(true);
              }}
              onClick={() => {
                toggleSoundMobile();
              }}
            />

            {/* ✅ TOP PILLS (gap garanti, ne se touchent plus) */}
            <div className="topPills" aria-hidden="true">
              {selected ? (
                <div className="selectedBadge" title="Template sélectionné">
                  ✅ Sélectionné
                </div>
              ) : (
                <span />
              )}

              <div className="soundHint">🔊 {soundOn ? "Son ON" : "Son OFF"}</div>
            </div>

            <button
              className="selectBtn"
              onClick={onSelect}
              style={{
                position: "absolute",
                left: 10,
                right: 10,
                bottom: 10,
                margin: "0 auto",
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.12)",
                background: selected
                  ? "rgba(16, 185, 129, 0.95)"
                  : "rgba(0,0,0,0.88)",
                color: "#fff",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 10px 24px rgba(0,0,0,0.16)",
              }}
              title="Sélectionner ce template"
            >
              {selected ? "Template sélectionné ✓" : "Sélectionner ce template"}
            </button>
          </div>
        ) : (
          <div style={{ padding: 18, opacity: 0.75 }}>
            Aucun preview_video_url
          </div>
        )}

        <div className="tplBody" style={{ padding: 14 }}>
          <div className="tplTitle" style={{ fontWeight: 900 }}>
            {t.name}
          </div>

          <div
            className="tplMeta"
            style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}
          >
            Catégorie :{" "}
            <strong>{(t.category ?? "").trim() ? t.category : "Autres"}</strong>
          </div>

          {/* ✅ description supprimée */}
        </div>
      </Card>

      <style jsx>{`
        .tplCard :global(video) {
          width: 100%;
          height: auto;
          display: block;
        }

        /* top pills layout */
        .tplCard :global(.topPills) {
          position: absolute;
          top: 10px;
          left: 10px;
          right: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px; /* 👈 espace entre les 2 pills */
          z-index: 6;
          pointer-events: none; /* ne gêne pas hover/click vidéo */
        }

        .tplCard :global(.selectedBadge) {
          background: rgba(16, 185, 129, 0.92);
          color: #fff;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .tplCard :global(.soundHint) {
          background: rgba(0, 0, 0, 0.55);
          color: #fff;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        /* bouton select */
        .tplCard :global(.selectBtn) {
          z-index: 4;
          word-break: keep-all;
        }

        @media (min-width: 641px) {
          .tplCard :global(.selectBtn) {
            left: 50% !important;
            right: auto !important;
            transform: translateX(-50%) !important;

            width: auto !important;
            max-width: calc(100% - 24px) !important;

            padding: 9px 14px !important;
            border-radius: 999px !important;

            font-size: 12px !important;
            letter-spacing: 0.15px !important;
            line-height: 1 !important;

            white-space: nowrap !important;
            overflow: visible !important;
            text-overflow: clip !important;
          }
        }

        @media (max-width: 640px) {
          .tplCard :global(.selectBtn) {
            padding: 8px 10px !important;
            border-radius: 12px !important;
            font-size: 12px !important;

            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          .tplCard :global(.tplBody) {
            padding: 10px !important;
          }
          .tplCard :global(.tplTitle) {
            font-size: 13px !important;
          }
          .tplCard :global(.tplMeta) {
            font-size: 11px !important;
          }

          .tplCard :global(.soundHint),
          .tplCard :global(.selectedBadge) {
            padding: 5px 8px !important;
            font-size: 11px !important;
          }
        }
      `}</style>
    </div>
  );
}
