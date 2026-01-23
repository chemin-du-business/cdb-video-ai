"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function GlowBg() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.16]" />
      <div className="absolute -top-48 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-500/18 via-violet-500/14 to-fuchsia-500/14 blur-3xl" />
      <div className="absolute top-48 -left-48 h-[560px] w-[560px] rounded-full bg-gradient-to-tr from-sky-500/14 via-cyan-500/12 to-emerald-500/12 blur-3xl" />
      <div className="absolute -bottom-64 right-[-140px] h-[620px] w-[620px] rounded-full bg-gradient-to-tr from-fuchsia-500/14 via-violet-500/12 to-indigo-500/16 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_0%,transparent,rgba(255,255,255,0.92))]" />
    </div>
  );
}

type UiState = "loading" | "ok";

export default function CheckEmailVerifiedClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [ui, setUi] = useState<UiState>("loading");
  const [hasSession, setHasSession] = useState(false);

  const nextPath = useMemo(() => {
    const n = sp.get("next");
    if (!n || !n.startsWith("/")) return "/app";
    return n;
  }, [sp]);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setUi("ok");
    };
    run();
  }, []);

  const title = ui === "loading" ? "Vérification…" : "Adresse email validée";
  const emoji = ui === "loading" ? "⏳" : "✅";

  return (
    <div className="relative min-h-screen bg-white text-black">
      <GlowBg />

      <header className="relative z-10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-black/10 bg-black/[0.03]">
              <span className="text-sm font-extrabold">CDB</span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold tracking-tight">CDB Video IA</div>
              <div className="truncate text-[11px] font-medium text-black/50">Développé en France 🇫🇷</div>
            </div>
          </Link>

          <Link
            href="/"
            className="hidden rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-black/80 hover:bg-black/[0.05] md:inline-flex"
          >
            Retour au site
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-16 pt-6">
        <div className="w-full max-w-xl">
          <div className="rounded-3xl border border-black/10 bg-white/80 p-6 text-center shadow-[0_30px_90px_-60px_rgba(0,0,0,0.35)] backdrop-blur md:p-8">
            <div className="text-5xl">{emoji}</div>

            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{title}</h1>

            <p className="mt-3 text-sm leading-6 text-black/60">
              {ui === "loading" ? (
                "Finalisation…"
              ) : (
                <>
                  Ton adresse email a bien été confirmée.
                  <br />
                  {hasSession
                    ? "Tu peux accéder à ton espace."
                    : "Tu peux maintenant te connecter (ou essayer d’accéder à l’app)."}
                </>
              )}
            </p>

            <div className="mt-6 grid gap-3">
              <button
                onClick={() => router.push(nextPath)}
                className="inline-flex h-12 items-center justify-center rounded-full bg-black px-6 text-sm font-semibold text-white hover:bg-black/90"
              >
                Accéder à l’application →
              </button>

              {!hasSession && (
                <Link
                  href={`/login?next=${encodeURIComponent(nextPath)}`}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-white/70 px-6 text-sm font-semibold text-black/80 hover:bg-black/[0.05]"
                >
                  Se connecter →
                </Link>
              )}

              <Link
                href="/"
                className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-white/70 px-6 text-sm font-semibold text-black/80 hover:bg-black/[0.05]"
              >
                Retour au site
              </Link>
            </div>
          </div>

          <div className="mt-4 text-center text-xs text-black/45">
            Besoin d’aide ?{" "}
            <Link href="/contact" className="font-medium text-black/70 hover:text-black">
              Contact
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
