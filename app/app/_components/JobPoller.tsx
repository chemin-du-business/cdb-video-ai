// JobPoller.tsx
"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function JobPoller() {
  const runningRef = useRef(false);

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

        await Promise.all(
          ids.map(async (id: string) => {
            try {
              const res = await fetch(`/api/video-jobs/${id}/refresh`, {
                method: "POST",
                headers: { Authorization: `Bearer ${session.access_token}` },
              });

              // le refresh fait son job côté DB (status/result/refund si besoin)
              // credits = gérés par realtime profiles (useCredits)
              if (!res.ok) return;
              await res.json().catch(() => null);
            } catch {
              // ignore
            }
          })
        );
      } finally {
        runningRef.current = false;
      }
    };

    tick();
    const t = setInterval(tick, 6000);
    return () => clearInterval(t);
  }, []);

  return null;
}
