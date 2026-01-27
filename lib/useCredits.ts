// /lib/useCredits.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/**
 * ✅ Store global (singleton) pour partager credits/loading partout
 * => l'optimistic update devient instantané dans le layout + toutes les pages
 */

type CreditsState = {
  credits: number | null;
  loading: boolean;
};

let state: CreditsState = { credits: null, loading: true };
const listeners = new Set<(s: CreditsState) => void>();

function emit(next: Partial<CreditsState>) {
  state = { ...state, ...next };
  for (const l of listeners) l(state);
}

let started = false;
let inFlight = false;

// realtime global
let channel: ReturnType<typeof supabase.channel> | null = null;
let currentUserId: string | null = null;

function stopRealtime() {
  channel?.unsubscribe();
  channel = null;
  currentUserId = null;
}

function startRealtime(userId: string) {
  if (currentUserId === userId && channel) return;

  stopRealtime();
  currentUserId = userId;

  channel = supabase
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
          emit({ credits: newCredits, loading: false });
        }
      }
    )
    .subscribe();
}

async function load() {
  if (inFlight) return;
  inFlight = true;

  emit({ loading: true });

  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;

    if (!user) {
      stopRealtime();
      emit({ credits: null, loading: false });
      return;
    }

    startRealtime(user.id);

    const { data, error } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("useCredits load error:", error);
      emit({ credits: 0, loading: false });
      return;
    }

    emit({ credits: data?.credits ?? 0, loading: false });
  } finally {
    inFlight = false;
  }
}

export function useCredits() {
  const [credits, setCredits] = useState<number | null>(state.credits);
  const [loading, setLoading] = useState<boolean>(state.loading);

  useEffect(() => {
    const listener = (s: CreditsState) => {
      setCredits(s.credits);
      setLoading(s.loading);
    };

    listeners.add(listener);

    // push current immediately
    listener(state);

    // start only once globally
    if (!started) {
      started = true;
      load();

      supabase.auth.onAuthStateChange(() => {
        load();
      });
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refetch = useCallback(async () => {
    await load();
  }, []);

  const applyOptimisticDelta = useCallback((delta: number) => {
    emit({
      credits: Math.max(0, (state.credits ?? 0) + delta),
      loading: false,
    });
  }, []);

  return { credits, loading, refetch, applyOptimisticDelta };
}
