"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const next = searchParams.get("next") || "/app";

      // Laisse le temps au route handler /auth/callback/route.ts
      // d’écrire les cookies si besoin
      await new Promise((r) => setTimeout(r, 50));

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      // si tu veux forcer confirmation email (optionnel)
      if (!session.user.email_confirmed_at) {
        router.replace("/check-email");
        return;
      }

      router.replace(next);
    };

    run();
  }, [router, searchParams]);

  return <p style={{ padding: 24 }}>Connexion en cours…</p>;
}
