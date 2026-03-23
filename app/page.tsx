"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TemplatePreview = {
  id: string;
  name: string;
  description: string | null;
  format: string | null;
  preview_video_url: string | null;
};

function GlowBg() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.18]" />
      <div className="absolute -top-48 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-500/18 via-violet-500/14 to-fuchsia-500/14 blur-3xl" />
      <div className="absolute top-48 -left-48 h-[560px] w-[560px] rounded-full bg-gradient-to-tr from-sky-500/14 via-cyan-500/12 to-emerald-500/12 blur-3xl" />
      <div className="absolute -bottom-64 right-[-140px] h-[620px] w-[620px] rounded-full bg-gradient-to-tr from-fuchsia-500/14 via-violet-500/12 to-indigo-500/16 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_0%,transparent,rgba(255,255,255,0.92))]" />
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs font-medium text-black/70">
      {children}
    </span>
  );
}

function Check() {
  return <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600/70" />;
}

function PreviewCard({
  title,
  subtitle,
  format = "9:16",
  videoUrl,
}: {
  title: string;
  subtitle: string;
  format?: string;
  videoUrl?: string | null;
}) {
  const [muted, setMuted] = useState(true);

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-black/10 bg-gradient-to-b from-white to-white shadow-[0_30px_80px_-40px_rgba(0,0,0,0.20)]">
      <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute -top-10 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-indigo-500/15 blur-2xl" />
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-black/80">{title}</div>
            <div className="truncate text-[10px] text-black/50">{subtitle}</div>
          </div>
          <div className="rounded-full border border-black/10 bg-black/[0.03] px-2 py-1 text-[10px] text-black/60">
            {format}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-b from-black/[0.03] to-black/[0.01]">
          <div className="absolute inset-0 bg-[radial-gradient(900px_450px_at_50%_0%,rgba(99,102,241,0.12),transparent)]" />

          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
            <div className="rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[10px] text-black/70 backdrop-blur">
              UGC / Ads
            </div>
          </div>

          {videoUrl ? (
            <>
              <video
                className="absolute inset-0 h-full w-full object-cover"
                src={videoUrl}
                muted={muted}
                loop
                playsInline
                autoPlay
                preload="metadata"
              />
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/75 px-3 py-1 text-[11px] font-semibold text-black/70 backdrop-blur hover:bg-white"
                aria-label={muted ? "Activer le son" : "Couper le son"}
                title={muted ? "Activer le son" : "Couper le son"}
              >
                <span className="leading-none">{muted ? "🔇" : "🔊"}</span>
                <span>{muted ? "Son off" : "Son on"}</span>
              </button>
            </>
          ) : (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-black/10 bg-white/70 backdrop-blur transition-transform duration-300 group-hover:scale-105">
                  <div className="ml-1 h-0 w-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-black/70" />
                </div>
              </div>

              <div className="absolute bottom-3 left-3 right-3 space-y-2">
                <div className="h-3 w-2/3 rounded bg-black/10" />
                <div className="h-3 w-1/2 rounded bg-black/10" />
              </div>
            </>
          )}

          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/0 via-white/0 to-white/15" />
        </div>
      </div>
    </div>
  );
}

function EmotionsCarousel({
  title = "Expressions & ton naturels",
  badge = "Nouveau",
  subtitle = "Tu peux varier l’intention, l’énergie et l’expression pour coller à ton script.",
  bullets = ["Expressions crédibles", "Ton cohérent avec le script", "Idéal Ads & UGC (vertical 9:16)"],
  images,
  autoplayMs = 2600,
}: {
  title?: string;
  badge?: string;
  subtitle?: string;
  bullets?: string[];
  images: { src: string; alt?: string }[];
  autoplayMs?: number;
}) {
  const items = useMemo(() => images ?? [], [images]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = window.setInterval(() => setIdx((v) => (v + 1) % items.length), autoplayMs);
    return () => window.clearInterval(t);
  }, [items.length, autoplayMs]);

  const progressPct = items.length ? ((idx + 1) / items.length) * 100 : 0;

  return (
    <div className="rounded-3xl border border-black/10 bg-white/70 p-4 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.25)] backdrop-blur md:p-6">
      <div className="grid gap-6 md:grid-cols-[1fr_0.9fr] md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-semibold tracking-tight text-black md:text-2xl">{title}</h3>
            {badge ? (
              <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[11px] font-medium text-black/60 backdrop-blur">
                {badge}
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-6 text-black/60 md:text-base">{subtitle}</p>

          <ul className="mt-5 space-y-2 text-sm text-black/60">
            {bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600/70" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[320px] md:max-w-[360px]">
          <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-b from-black/[0.03] to-black/[0.01]">
            {items.length > 1 ? (
              <div className="absolute left-3 right-3 top-3 z-10">
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/70 backdrop-blur">
                  <div className="h-full bg-black/60 transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            ) : null}

            {items[idx]?.src ? (
              <img
                className="absolute inset-0 h-full w-full object-cover"
                src={items[idx].src}
                alt={items[idx].alt ?? `Emotion ${idx + 1}`}
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-xs font-medium text-black/55">Ajoute des images au carousel</div>
              </div>
            )}

            {items.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => setIdx((v) => (v - 1 + items.length) % items.length)}
                  className="absolute inset-y-0 left-0 z-10 w-1/2 bg-transparent"
                  aria-label="Image précédente"
                  title="Précédent"
                />
                <button
                  type="button"
                  onClick={() => setIdx((v) => (v + 1) % items.length)}
                  className="absolute inset-y-0 right-0 z-10 w-1/2 bg-transparent"
                  aria-label="Image suivante"
                  title="Suivant"
                />
              </>
            ) : null}

            {items.length > 1 ? (
              <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2">
                {items.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIdx(i)}
                    className={["h-2 w-2 rounded-full border border-black/15", i === idx ? "bg-black/65" : "bg-white/70"].join(" ")}
                    aria-label={`Aller à l’image ${i + 1}`}
                    title={`Aller à l’image ${i + 1}`}
                  />
                ))}
              </div>
            ) : null}

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [checkingLogin, setCheckingLogin] = useState(false);

  const handleLoginClick = async () => {
    if (checkingLogin) return;
    setCheckingLogin(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.push("/app");
      else router.push("/login?next=%2Fapp");
    } finally {
      setCheckingLogin(false);
    }
  };

  const [previews, setPreviews] = useState<TemplatePreview[]>([]);
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("id,name,description,format,preview_video_url")
        .eq("is_active", true)
        .not("preview_video_url", "is", null)
        .order("position", { ascending: true })
        .limit(4);

      if (!mounted) return;

      if (error) {
        console.error("templates preview error:", error.message);
        setPreviews([]);
        return;
      }

      setPreviews((data ?? []) as TemplatePreview[]);
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const fallbackCards = [
    { title: "Script → Vidéo", subtitle: "Tu écris, l’IA joue." },
    { title: "Image → Vidéo", subtitle: "Tu fournis une image, l’IA anime." },
    { title: "Template → Remix", subtitle: "Tu pars d’un style, tu variantes." },
    { title: "Variantes A/B", subtitle: "Hooks, CTA, ton, rythme." },
  ];

  const cardsToShow =
    previews.length > 0
      ? previews.map((t) => ({
          title: t.name,
          subtitle: t.description ?? "",
          format: t.format ?? "9:16",
          videoUrl: t.preview_video_url,
        }))
      : fallbackCards.map((c) => ({ ...c, format: "9:16", videoUrl: null as string | null }));

  const emotionsImages = [
    {
      src: "https://gnkfjfhlxkwvuxegdged.supabase.co/storage/v1/object/public/Image/image4%20copie.png",
      alt: "Emotion 1",
    },
    {
      src: "https://gnkfjfhlxkwvuxegdged.supabase.co/storage/v1/object/public/Image/image5%20copie.png",
      alt: "Emotion 2",
    },
    {
      src: "https://gnkfjfhlxkwvuxegdged.supabase.co/storage/v1/object/public/Image/image7%20copie.png",
      alt: "Emotion 3",
    },
  ];

  const ctaImageUrl =
    "https://gnkfjfhlxkwvuxegdged.supabase.co/storage/v1/object/public/Image/image3.png";

  return (
    <div className="relative min-h-screen bg-white font-sans text-black">
      <GlowBg />

      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/70 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <a href="#" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/[0.03]">
              <span className="text-sm font-semibold text-black">CDB</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-black">CDB Video IA</span>
          </a>

          <div className="hidden items-center gap-6 text-sm text-black/60 md:flex">
            <a className="hover:text-black" href="#how">
              Comment ça marche
            </a>
            <a className="hover:text-black" href="#faq">
              FAQ
            </a>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleLoginClick}
              disabled={checkingLogin}
              className="inline-flex items-center justify-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/90 disabled:opacity-60"
            >
              {checkingLogin ? "Redirection…" : "Accéder à l’app"}
              <span className="ml-2">→</span>
            </button>
          </div>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="mx-auto w-full max-w-6xl px-6 pt-10 pb-10 md:pt-16">
          <div className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="mb-5 flex flex-wrap gap-2">
                <Pill>⚡ Script, Image ou Template</Pill>
                <Pill>📱 Reels · Shorts · TikTok</Pill>
                <Pill>🎯 Variantes A/B</Pill>
              </div>

              <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-black md:text-6xl">
                Génère des{" "}
                <span className="bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-700 bg-clip-text text-transparent">
                  vidéos courtes
                </span>{" "}
                prêtes à publier, sans tournage.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-black/65 md:text-lg">
                Tu choisis un mode (script, image ou template), tu ajustes l’angle, puis tu lances. En quelques minutes,
                tu récupères une vidéo verticale 9:16 exploitable pour tes pubs et ton contenu.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/signup"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-black px-6 text-sm font-semibold text-white hover:bg-black/90"
                >
                  Créer ma première vidéo
                  <span className="ml-2">→</span>
                </Link>

                <a
                  href="#how"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-white/70 px-6 text-sm font-semibold text-black/80 hover:bg-black/[0.05]"
                >
                  Voir comment ça marche
                </a>
              </div>

              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-black/55">
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600/70" /> Export 9:16
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600/70" /> Téléchargement instant
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600/70" /> Variantes (A/B)
                </span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-tr from-indigo-500/12 via-violet-500/10 to-fuchsia-500/12 blur-2xl" />
              <div className="grid grid-cols-2 gap-4">
                <div className="translate-y-6">
                  <PreviewCard
                    title={cardsToShow[0]?.title ?? "Script → Vidéo"}
                    subtitle={cardsToShow[0]?.subtitle ?? "Tu écris, l’IA joue."}
                    format={cardsToShow[0]?.format ?? "9:16"}
                    videoUrl={cardsToShow[0]?.videoUrl}
                  />
                </div>
                <div className="-translate-y-2">
                  <PreviewCard
                    title={cardsToShow[1]?.title ?? "Image → Vidéo"}
                    subtitle={cardsToShow[1]?.subtitle ?? "Tu fournis une image, l’IA anime."}
                    format={cardsToShow[1]?.format ?? "9:16"}
                    videoUrl={cardsToShow[1]?.videoUrl}
                  />
                </div>
                <div className="translate-y-2">
                  <PreviewCard
                    title={cardsToShow[2]?.title ?? "Template → Remix"}
                    subtitle={cardsToShow[2]?.subtitle ?? "Tu pars d’un style, tu variantes."}
                    format={cardsToShow[2]?.format ?? "9:16"}
                    videoUrl={cardsToShow[2]?.videoUrl}
                  />
                </div>
                <div className="-translate-y-6">
                  <PreviewCard
                    title={cardsToShow[3]?.title ?? "Variantes A/B"}
                    subtitle={cardsToShow[3]?.subtitle ?? "Hooks, CTA, ton, rythme."}
                    format={cardsToShow[3]?.format ?? "9:16"}
                    videoUrl={cardsToShow[3]?.videoUrl}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-16">
          <div className="rounded-3xl border border-black/10 bg-white/70 p-6 backdrop-blur md:p-8">
            <p className="text-xs font-medium tracking-wide text-black/50">
              UTILISÉ POUR DES PUBS, DU CONTENU, DES LANDINGS & DES OFFRES
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-5">
              {["E-commerce", "Agences", "Infopreneurs", "Marques", "Services"].map((x) => (
                <div
                  key={x}
                  className="flex items-center justify-center rounded-2xl border border-black/10 bg-black/[0.02] py-4 text-sm text-black/70"
                >
                  {x}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="flex items-end justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-black md:text-3xl">
                Comment ça marche (simple, rapide, efficace)
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/60">
                Tu n’as pas besoin de filmer : tu choisis un mode, tu donnes l’angle, tu génères.
              </p>
            </div>

            <a
              href="/signup"
              className="hidden rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-black/90 md:inline-flex"
            >
              Démarrer
              <span className="ml-2">→</span>
            </a>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "1) Choisis ton point de départ",
                desc: "Script → vidéo, Image → vidéo, ou Template → remix. Tu pars de ce que tu as déjà.",
                bullets: ["Script complet", "Image produit / visage", "Template prêt à adapter"],
              },
              {
                title: "2) Donne l’angle (hook + intention)",
                desc: "Tu ajustes le ton, l’énergie, et le message. L’outil s’occupe du rendu.",
                bullets: ["Hook + bénéfice", "CTA clair", "Variantes (A/B)"],
              },
              {
                title: "3) Génère, télécharge, publie",
                desc: "Une vidéo verticale prête à être utilisée en pub ou en contenu.",
                bullets: ["Export 9:16", "Téléchargement", "Duplication / remix"],
              },
            ].map((s) => (
              <div
                key={s.title}
                className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.25)] backdrop-blur"
              >
                <div className="text-sm font-semibold text-black">{s.title}</div>
                <p className="mt-2 text-sm leading-6 text-black/60">{s.desc}</p>
                <ul className="mt-4 space-y-2 text-sm text-black/60">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="relative overflow-hidden rounded-[32px]">
            <GlowBg />
            <div className="relative">
              <EmotionsCarousel images={emotionsImages} autoplayMs={3000} />
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="rounded-3xl border border-black/10 bg-white/70 p-6 backdrop-blur md:p-10">
            <h2 className="text-2xl font-semibold tracking-tight text-black md:text-3xl">FAQ</h2>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {[
                {
                  q: "Je peux créer sans template ?",
                  a: "Oui. Tu peux générer à partir d’un script (texte) ou d’une image. Les templates servent aussi à accélérer quand tu veux un style précis.",
                },
                {
                  q: "Quel format je reçois ?",
                  a: "Du vertical 9:16 prêt pour Reels / Shorts / TikTok. Tu télécharges depuis la bibliothèque.",
                },
                {
                  q: "Je peux faire plusieurs variantes ?",
                  a: "Oui. Duplique une vidéo et change uniquement le hook, le CTA ou le ton pour tester.",
                },
                {
                  q: "Ça prend combien de temps ?",
                  a: "Quelques minutes en général. Les vidéos en cours s’affichent dans la bibliothèque avec un statut.",
                },
                {
                  q: "Je dois filmer quelque chose ?",
                  a: "Non. Tout se fait depuis l’app (script, image ou template).",
                },
              ].map((i) => (
                <div key={i.q} className="rounded-3xl border border-black/10 bg-white p-6">
                  <div className="text-sm font-semibold text-black">{i.q}</div>
                  <div className="mt-2 text-sm text-black/60">{i.a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-20">
          <div className="relative overflow-hidden rounded-3xl border border-black/10 bg-gradient-to-r from-indigo-500/12 via-violet-500/10 to-fuchsia-500/12 p-8 md:p-10">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-black/5 blur-3xl" />

            <div className="grid items-center gap-6 md:grid-cols-[1fr_420px]">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-black md:text-3xl">
                  Lance ta première vidéo aujourd’hui.
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-black/60">
                  Script, image ou template — puis variantes A/B. Télécharge, publie, et recommence.
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/signup"
                    className="inline-flex h-12 items-center justify-center rounded-full bg-black px-6 text-sm font-semibold text-white hover:bg-black/90"
                  >
                    Créer ma première vidéo
                    <span className="ml-2">→</span>
                  </Link>
                </div>
              </div>

              <div className="relative md:justify-self-end">
                <img
                  src={ctaImageUrl}
                  alt="Aperçu CDB Video IA"
                  loading="lazy"
                  className="mx-auto w-full max-w-[520px] object-contain md:mx-0 motion-safe:animate-[float_6s_ease-in-out_infinite]"
                />
              </div>
            </div>
          </div>

          <style jsx global>{`
            @keyframes float {
              0%,
              100% {
                transform: translateY(0);
              }
              50% {
                transform: translateY(-10px);
              }
            }
          `}</style>
        </section>

        <footer className="mx-auto w-full max-w-6xl px-6 pb-10 text-xs text-black/45">
          <div className="flex flex-col justify-between gap-4 border-t border-black/10 pt-6 sm:flex-row sm:items-center">
            <div>© {new Date().getFullYear()} CDB Video IA — Tous droits réservés</div>
            <div className="flex gap-4">
              <a className="hover:text-black" href="/mentions-legales">
                Mentions légales
              </a>
              <a className="hover:text-black" href="/privacy">
                Confidentialité
              </a>
              <a className="hover:text-black" href="/contact">
                Contact
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}