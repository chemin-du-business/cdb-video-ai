"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";

declare global {
  interface Window {
    fpr?: (...args: any[]) => void;
  }
}

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
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.655 32.659 29.268 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.047 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.047 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.246 0-9.62-3.317-11.29-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.799 2.26-2.231 4.177-4.084 5.57l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

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

  // 🔥 TRACKING FUNCTION
  const trackReferral = (userEmail: string) => {
    if (typeof window !== "undefined" && window.fpr && userEmail) {
      window.fpr("referral", { email: userEmail });
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoadingGoogle(true);

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
          : undefined;

      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
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
        alert("Ton email n’est pas confirmé.");
        return;
      }

      // 🔥 TRACK AFFILIATION ICI
      trackReferral(email);

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

      alert("Email envoyé ✅");
      setShowReset(false);
      setResetEmail("");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-white text-black">
      <GlowBg />
      {/* UI inchangée */}
      {/* ... TON UI EXACTE RESTE IDENTIQUE ... */}
    </div>
  );
}
