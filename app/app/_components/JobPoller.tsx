"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCredits } from "@/lib/useCredits";

type RefreshResponse =
  | { status: "queued" | "processing"; progress?: number }
  | {
      status: "done";
      result_video_url?: string;
      charged?: boolean;
      already_charged?: boolean;
      cost_credits?: number;
    }
  | { status: "failed"; error?: string };

export default function JobPoller() {
  const runningRef = useRef(false);

  // ✅ évite de refetch en boucle si plusieurs jobs finissent
  const lastCreditsRefetchRef = useRef<number>(0);

  const { refetch: refetchCredits } = useCredits();

  useEffect(() => {
    const tick = async () => {
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user?.id) return;

        // On récupère les jobs en cours
        const { data: jobs, error: jobsErr } = await supabase
          .from("video_jobs")
          .select("id,status,result_video_url")
          .eq("user_id", session.user.id)
          .in("status", ["queued", "processing"])
          .is("result_video_url", null)
          .order("created_at", { ascending: false })
          .limit(20);

        if (jobsErr) {
          console.error("JobPoller jobs select error:", jobsErr);
          return;
        }

        const ids = (jobs ?? []).map((j: any) => j.id).filter(Boolean);
        if (ids.length === 0) return;

        // ✅ si un job devient done -> on refetch les crédits
        let anyDone = false;

        await Promise.all(
          ids.map(async (id: string) => {
            try {
              const res = await fetch(`/api/video-jobs/${id}/refresh`, {
                method: "POST",
                headers: { Authorization: `Bearer ${session.access_token}` },
                cache: "no-store",
              });

              const data = (await res.json().catch(() => null)) as RefreshResponse | null;

              if (data?.status === "done") {
                anyDone = true;
              }
            } catch {
              // ignore
            }
          })
        );

        if (anyDone) {
          const now = Date.now();

          // cooldown 2s pour éviter spam si 3 jobs finissent ensemble
          if (now - lastCreditsRefetchRef.current > 2000) {
            lastCreditsRefetchRef.current = now;
            await refetchCredits();
          }
        }
      } finally {
        runningRef.current = false;
      }
    };

    // Tick immédiat + interval
    tick();
    const t = setInterval(tick, 3000);
    return () => clearInterval(t);
  }, [refetchCredits]);

  return null;
}
