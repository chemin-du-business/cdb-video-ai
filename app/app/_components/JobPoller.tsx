// JobPoller.tsx
"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCredits } from "@/lib/useCredits";

export default function JobPoller() {
  const runningRef = useRef(false);
  const { refetch } = useCredits();

  useEffect(() => {
    const tick = async () => {
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user?.id) return;

        const { data: jobs } = await supabase
          .from("video_jobs")
          .select("id,status,result_video_url")
          .eq("user_id", session.user.id)
          .in("status", ["queued", "processing"])
          .is("result_video_url", null)
          .order("created_at", { ascending: false })
          .limit(20);

        const ids = (jobs ?? []).map((j: any) => j.id).filter(Boolean);
        if (ids.length === 0) return;

        // Collecte des statuts retournés
        const results = await Promise.all(
          ids.map(async (id: string) => {
            try {
              const res = await fetch(`/api/video-jobs/${id}/refresh`, {
                method: "POST",
                headers: { Authorization: `Bearer ${session.access_token}` },
              });

              if (!res.ok) return null;
              return await res.json().catch(() => null);
            } catch {
              return null;
            }
          })
        );

        /**
         * Nouveau modèle crédits :
         * - débit fait AU LANCEMENT (queued)
         * - refund si status === "failed"
         * - "done" ne touche plus aux crédits
         *
         * Realtime met normalement le solde à jour,
         * refetch ici = simple sécurité.
         */
        const shouldRefetchCredits = results.some((r: any) => {
          if (!r) return false;
          return r.status === "failed";
        });

        if (shouldRefetchCredits) {
          await refetch();
        }
      } finally {
        runningRef.current = false;
      }
    };

    // tick immédiat + toutes les 6s
    tick();
    const t = setInterval(tick, 6000);
    return () => clearInterval(t);
  }, [refetch]);

  return null;
}
