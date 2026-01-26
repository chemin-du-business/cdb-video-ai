"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";

function GlowBg() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.18]" />
      <div className="absolute -top-48 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-500/18 via-violet-500/14 to-fuchsia-500/14 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_0%,transparent,rgba(255,255,255,0.92))]" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.655 32.659 29.268 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.047 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.047 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.246 0-9.62-3.317-11.29-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.799 2.26-2.231 4.177-4.084 5.57l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  // ✅ sécurise next
  const nextPath = useMemo(() => {
    const n = sp.get("next");
    if (!n || !n.startsWith("/")) return "/app";
    return n;
  }, [sp]);

  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingEmail, setLoadingEmail] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const signInWithGoogle = async () => {
    try {
      setLoadingGoogle(true);

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
          : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (error) alert(error.message);
    } finally {
      setLoadingGoogle(false);
    }
  };

  const signInWithEmail = async () => {
    if (!email.trim() || !password.trim()) {
      alert("Email et mot de passe requis.");
      return;
    }

    setLoadingEmail(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        alert(error.message);
        return;
      }

      const user = data.user;
      if (user && !user.email_confirmed_at) {
        await supabase.auth.signOut();
        alert("Ton email n’est pas confirmé. Regarde ta boîte mail et clique sur le lien.");
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } finally {
      setLoadingEmail(false);
    }
  };

  const sendResetPassword = async () => {
    const e = (resetEmail || email).trim();
    if (!e) {
      alert("Entre ton email.");
      return;
    }

    setResetLoading(true);
    try {
      const supabaseImplicit = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { flowType: "implicit" } }
      );

      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;

      const { error } = await supabaseImplicit.auth.resetPasswordForEmail(e, { redirectTo });

      if (error) {
        alert(error.message);
        return;
      }

      alert("Email envoyé ✅ Ouvre le lien pour changer ton mot de passe.");
      setShowReset(false);
      setResetEmail("");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-white text-black">
      <GlowBg />

      {/* HEADER */}
      <header className="relative z-10 border-b border-black/10 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-black/10 bg-black/[0.03]">
              <span className="text-sm font-bold">CDB</span>
            </div>
            <span className="text-sm font-semibold tracking-tight">CDB Video IA</span>
          </Link>

          <Link
            href="/"
            className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-black/70 hover:bg-black/[0.05]"
          >
            Retour au site
          </Link>
        </div>
      </header>

      {/* CENTERED CARD */}
      <main className="relative z-10 flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
        <div className="w-full max-w-[520px]">
          <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.35)] backdrop-blur md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold">Connexion</h1>
                <p className="mt-1 text-sm text-black/55">Connecte-toi pour créer ta vidéo en quelques minutes</p>
              </div>
              <span className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs text-black/60">
                Securisé
              </span>
            </div>

            {/* ✅ GOOGLE FIRST */}
            <button
              onClick={signInWithGoogle}
              disabled={loadingGoogle || loadingEmail || resetLoading}
              className="mt-7 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-black text-sm font-semibold text-white hover:bg-black/90 disabled:opacity-60"
            >
              {loadingGoogle ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Connexion…
                </>
              ) : (
                <>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white">
                    <GoogleIcon />
                  </span>
                  Continuer avec Google
                </>
              )}
            </button>

            {/* divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-black/10" />
              <span className="text-xs text-black/40">ou</span>
              <div className="h-px flex-1 bg-black/10" />
            </div>

            {/* EMAIL/PASSWORD */}
            <div className="space-y-4">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com"
                type="email"
                className="h-14 w-full rounded-2xl border border-black/10 px-5 text-sm"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                className="h-14 w-full rounded-2xl border border-black/10 px-5 text-sm"
              />

              <button
                onClick={signInWithEmail}
                disabled={loadingEmail || loadingGoogle || resetLoading}
                className="h-14 w-full rounded-full bg-black text-sm font-semibold text-white hover:bg-black/90 disabled:opacity-60"
              >
                {loadingEmail ? "Connexion…" : "Se connecter"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowReset((v) => !v);
                  setResetEmail(email);
                }}
                disabled={loadingEmail || loadingGoogle || resetLoading}
                className="text-left text-xs font-semibold text-black/70 hover:text-black"
              >
                Mot de passe oublié ?
              </button>

              {showReset && (
                <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                  <div className="text-xs font-semibold text-black/70">Réinitialiser</div>

                  <input
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="ton@email.com"
                    type="email"
                    className="mt-3 h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-black/25"
                  />

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={sendResetPassword}
                      disabled={resetLoading || loadingEmail || loadingGoogle}
                      className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-black px-4 text-sm font-semibold text-white hover:bg-black/90 disabled:opacity-60"
                    >
                      {resetLoading ? "Envoi…" : "Envoyer"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowReset(false);
                        setResetEmail("");
                      }}
                      disabled={resetLoading}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-black/70 hover:bg-black/[0.03] disabled:opacity-60"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-6 text-xs text-black/45">
              En continuant, tu acceptes nos{" "}
              <a href="/terms" className="font-medium text-black hover:underline">
                conditions
              </a>{" "}
              et notre{" "}
              <a href="/privacy" className="font-medium text-black hover:underline">
                confidentialité
              </a>
              .
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-black/55">
            Pas de compte ?{" "}
            <Link
              href={`/signup?next=${encodeURIComponent(nextPath)}`}
              className="font-semibold text-black"
            >
              Créer un compte
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
