"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

declare global {
  interface Window {
    fpr?: (...args: any[]) => void;
  }
}

export default function FprCallbackClient() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const next = sp.get("next") || "/app";

      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (typeof window !== "undefined" && window.fpr && user?.email) {
        window.fpr("referral", {
          email: user.email,
        });
      }

      router.replace(next);
    };

    run();
  }, [router, sp]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white text-black">
      <p className="text-sm text-black/60">Connexion en cours…</p>
    </div>
  );
}
