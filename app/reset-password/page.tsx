"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

function parseHashTokens() {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash?.replace("#", "") || "";
  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const type = params.get("type");
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token, type };
}

export default function ResetPasswordPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (saving) return false;
    if (newPassword.trim().length < 6) return false;
    if (newPassword !== confirmPassword) return false;
    return true;
  }, [newPassword, confirmPassword, saving]);

  useEffect(() => {
    const run = async () => {
      try {
        const tokens = parseHashTokens();
        setHasToken(!!tokens);

        // Si pas de tokens, on montre un état "lien manquant"
        if (!tokens) return;

        const { error } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        });

        // Nettoyage URL (retire le #access_token=...)
        window.history.replaceState({}, document.title, "/reset-password");

        if (error) {
          setErrorMsg("Lien invalide ou expiré. Redemande un email de réinitialisation.");
        }
      } finally {
        setBooting(false);
      }
    };

    run();
  }, []);

  useEffect(() => {
    if (!booting && !hasToken) setBooting(false);
  }, [booting, hasToken]);

  const save = async () => {
    setErrorMsg(null);
    setOkMsg(null);

    if (newPassword.trim().length < 6) {
      setErrorMsg("Mot de passe trop court (min 6 caractères).");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Les mots de passe ne correspondent pas.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setOkMsg("Mot de passe mis à jour ✅ Redirection…");

      // Sécurité : on déconnecte et on renvoie vers login
      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace("/login?reset=ok");
        router.refresh();
      }, 900);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-white text-black">
      <GlowBg />

      {/* Top bar */}
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
          <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-[0_30px_90px_-60px_rgba(0,0,0,0.35)] backdrop-blur md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Réinitialisation</div>
                <div className="mt-1 text-sm text-black/60">Choisis un nouveau mot de passe.</div>
              </div>
              <span className="rounded-full border border-black/10 bg-black/[0.03] px-2 py-1 text-[10px] font-medium text-black/60">
                Secure
              </span>
            </div>

            {booting ? (
              <div className="mt-6 rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-sm text-black/70">
                Chargement du lien…
              </div>
            ) : !hasToken ? (
              <div className="mt-6 rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-sm text-black/70">
                Ce lien n’est pas valide (token manquant). <br />
                Redemande un email de réinitialisation depuis la page{" "}
                <Link href="/login" className="font-semibold text-black/80 hover:text-black">
                  connexion
                </Link>
                .
              </div>
            ) : (
              <>
                {/* Alerts */}
                {errorMsg && (
                  <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700">
                    {errorMsg}
                  </div>
                )}
                {okMsg && (
                  <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-800">
                    {okMsg}
                  </div>
                )}

                {/* Form */}
                <div className="mt-6 grid gap-3">
                  <div>
                    <div className="text-xs font-semibold text-black/60">Nouveau mot de passe</div>
                    <input
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      type="password"
                      placeholder="••••••••"
                      className="mt-2 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm outline-none ring-0 placeholder:text-black/35 focus:border-black/20"
                    />
                    <div className="mt-2 text-[12px] text-black/45">Minimum 6 caractères.</div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-black/60">Confirmer</div>
                    <input
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      type="password"
                      placeholder="••••••••"
                      className="mt-2 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-black/35 focus:border-black/20"
                    />
                    {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                      <div className="mt-2 text-[12px] text-red-700/80">
                        Les mots de passe ne correspondent pas.
                      </div>
                    )}
                  </div>

                  <button
                    onClick={save}
                    disabled={!canSubmit}
                    className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-full bg-black px-5 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Enregistrement…
                      </>
                    ) : (
                      "Enregistrer le mot de passe"
                    )}
                  </button>

                  <div className="text-center text-xs text-black/45">
                    Après changement, tu seras redirigé vers la connexion.
                  </div>
                </div>
              </>
            )}
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
