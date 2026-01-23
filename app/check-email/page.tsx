"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none">
      <path
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m6.5 8 5.2 4.05a1 1 0 0 0 1.2 0L18.5 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CheckEmailPage() {
  const router = useRouter();
  const params = useSearchParams();

  const email = params.get("email") || "";
  const nextParam = params.get("next");

  const nextPath = useMemo(() => {
    if (!nextParam) return "/app/library";
    if (!nextParam.startsWith("/")) return "/app/library";
    return nextParam;
  }, [nextParam]);

  // ✅ Gating : si accès direct sans email, on renvoie vers signup
  useEffect(() => {
    if (!email) {
      router.replace("/signup");
      router.refresh();
    }
  }, [email, router]);

  // Optionnel: éviter un flash avant redirect
  if (!email) return null;

  return (
    <div className="relative min-h-screen bg-white text-black">
      <GlowBg />

      {/* TOP BAR (simple) */}
      <header className="relative z-10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/[0.03]">
              <span className="text-sm font-semibold text-black">CDB</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-black">
              CDB Video IA
            </span>
          </Link>

          <Link
            href="/"
            className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-black/80 hover:bg-black/[0.05]"
          >
            Retour au site
          </Link>
        </div>
      </header>

      {/* CENTERED CARD (simple) */}
      <main className="relative z-10 flex min-h-[calc(100vh-96px)] items-center justify-center px-4">
        <div className="w-full max-w-[560px]">
          <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.35)] backdrop-blur md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold">Vérifie ta boîte mail</h1>
                <p className="mt-1 text-sm text-black/55">
                  On t’a envoyé un lien de confirmation{" "}
                  <span className="font-medium text-black/80">{email}</span>.
                </p>
              </div>

              <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-[11px] font-medium text-black/60">
                <MailIcon />
                Email
              </span>
            </div>

            <div className="mt-6 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
              <div className="text-xs font-semibold text-black/70">Étapes</div>
              <ol className="mt-3 space-y-2 text-sm text-black/60">
                <li className="flex gap-2">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/[0.06] text-[11px] font-semibold text-black/70">
                    1
                  </span>
                  <span>Ouvre l’email de confirmation.</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/[0.06] text-[11px] font-semibold text-black/70">
                    2
                  </span>
                  <span>Clique sur le lien pour activer ton compte.</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/[0.06] text-[11px] font-semibold text-black/70">
                    3
                  </span>
                  <span>Reviens ici et connecte-toi.</span>
                </li>
              </ol>
            </div>

            <Link
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-black px-5 text-sm font-semibold text-white hover:bg-black/90"
            >
              Aller à la connexion <span className="ml-2">→</span>
            </Link>

            <div className="mt-5 text-xs text-black/45">
              Rien reçu ? Vérifie les spams / promotions.
            </div>
          </div>

          <div className="mt-4 text-center text-xs text-black/45">
            Tu t’es trompé d’email ?{" "}
            <Link className="font-medium text-black/70 hover:text-black" href="/signup">
              Refaire l’inscription
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
