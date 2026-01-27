// /lib/useCredits.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

export function useCredits() {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  // ✅ Optimistic UI (pour update instant côté UI)
  const optimisticRef = useRef(0);
  const applyOptimisticDelta = useCallback((delta: number) => {
    optimisticRef.current += delta;

    setCredits((c) => {
      const base = typeof c === "number" ? c : 0;
      // clamp à 0 pour éviter affichage négatif
      return Math.max(0, base + delta);
    });
  }, []);

  // ✅ Realtime channel (un seul à la fois)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userIdRef = useRef<string | null>(null);

  const unsubscribeRealtime = useCallback(() => {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    userIdRef.current = null;
  }, []);

  const subscribeRealtime = useCallback(
    (userId: string) => {
      // évite de resubscribe si déjà sur le même user
      if (userIdRef.current === userId && channelRef.current) return;

      // reset ancien channel si user différent
      unsubscribeRealtime();

      userIdRef.current = userId;

      channelRef.current = supabase
        .channel(`realtime:profiles:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            const newCredits = (payload.new as any)?.credits;

            if (typeof newCredits === "number") {
              // ✅ Realtime = source de vérité
              // On reset l'optimistic et on colle la valeur DB.
              optimisticRef.current = 0;
              setCredits(newCredits);
            }
          }
        )
        .subscribe();
    },
    [unsubscribeRealtime]
  );

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
          optimisticRef.current = 0;
          setCredits(null);
          setLoading(false);
        }
        unsubscribeRealtime(); // ✅ stop realtime si logout
        return;
      }

      // ✅ s'abonner en realtime dès qu'on a un user
      subscribeRealtime(user.id);

      const { data, error } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .single();

      if (!mountedRef.current) return;

      if (error) {
        console.error("useCredits load error:", error);
        optimisticRef.current = 0;
        setCredits(0);
      } else {
        // ✅ DB = source de vérité
        optimisticRef.current = 0;
        setCredits(data?.credits ?? 0);
      }

      setLoading(false);
    } finally {
      inFlightRef.current = false;
    }
  }, [subscribeRealtime, unsubscribeRealtime]);

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
      unsubscribeRealtime(); // ✅ cleanup
    };
  }, [load, unsubscribeRealtime]);

  // ✅ refetch manuel (JobPoller peut l’utiliser en backup)
  const refetch = useCallback(async () => {
    await load();
  }, [load]);

  return { credits, loading, refetch, applyOptimisticDelta };
}
