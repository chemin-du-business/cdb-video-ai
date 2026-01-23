"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  const logout = async () => {
    setLoading(true);

    // 1️⃣ Déconnexion Supabase (client)
    await supabase.auth.signOut();

    // 2️⃣ Redirection propre + reset du cache
    router.replace("/login");
    router.refresh(); // 🔥 CRUCIAL : force le middleware à rechecker
  };

  return (
    <div>
      <h1 style={{ fontSize: 28, margin: 0, letterSpacing: -0.6 }}>
        Compte
      </h1>
      <div style={{ opacity: 0.75, marginTop: 6 }}>
        Gère ton profil et ta session.
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.10)",
          background: "rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ fontWeight: 900 }}>Email</div>
        <div style={{ opacity: 0.8, marginTop: 6 }}>
          {email ?? "—"}
        </div>

        <button
          onClick={logout}
          disabled={loading}
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "rgba(0,0,0,0.9)",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </div>
    </div>
  );
}
