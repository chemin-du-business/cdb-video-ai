"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

export function useCredits() {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (!mountedRef.current) return;

    // évite les appels multiples en parallèle
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setLoading(true);

    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;

      if (!user) {
        if (mountedRef.current) {
          setCredits(null);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .single();

      if (!mountedRef.current) return;

      if (error) {
        console.error("useCredits load error:", error);
        setCredits(0);
      } else {
        setCredits(data?.credits ?? 0);
      }

      setLoading(false);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // initial load
    load();

    // reload on auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      mountedRef.current = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  // ✅ refetch manuel (JobPoller va l’utiliser quand status = done)
  const refetch = useCallback(async () => {
    await load();
  }, [load]);

  return { credits, loading, refetch };
}
