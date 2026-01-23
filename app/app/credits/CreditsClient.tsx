"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "rgba(255,255,255,0.92)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

type PackKey = "unit" | "pack10" | "pack20" | "pack40";

type ReceiptRow = {
  id: string;
  created_at: string;
  delta: number;
  reason: string;
  amount_total: number | null;
  currency: string | null;
  receipt_url: string | null;
  stripe_charge_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_session_id: string | null;
};

function fmtMoney(amount: number | null, currency: string | null) {
  if (!amount || !currency) return "—";
  const euros = amount / 100;
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(euros);
  } catch {
    return `${euros.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleString("fr-FR");
  } catch {
    return d;
  }
}

/** ✅ Transforme reason technique -> libellé lisible */
function friendlyReason(reason: string) {
  const r = (reason || "").toLowerCase();

  if (r.includes("stripe_checkout_unit") || r.includes("checkout_unit") || r === "unit") {
    return "À l’unité (1 vidéo)";
  }
  if (r.includes("stripe_checkout_pack10") || r.includes("checkout_pack10") || r.includes("pack10")) {
    return "Pack 10 vidéos";
  }
  if (r.includes("stripe_checkout_pack20") || r.includes("checkout_pack20") || r.includes("pack20")) {
    return "Pack 20 vidéos";
  }
  if (r.includes("stripe_checkout_pack40") || r.includes("checkout_pack40") || r.includes("pack40")) {
    return "Pack 40 vidéos";
  }

  if (!reason) return "Achat";
  return reason.replaceAll("_", " ");
}

export default function CreditsClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [loadingPack, setLoadingPack] = useState<PackKey | null>(null);

  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(true);

  const state = useMemo(() => {
    if (sp.get("checkout") === "success") return "success";
    if (sp.get("checkout") === "cancel") return "cancel";
    return "idle";
  }, [sp]);

  const startCheckout = async (pack: PackKey) => {
    try {
      setLoadingPack(pack);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        alert("Session expirée, merci de te reconnecter.");
        router.push("/login");
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pack }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Impossible d’ouvrir le paiement.");
        return;
      }

      if (!data.url) {
        alert("Lien de paiement manquant.");
        return;
      }

      window.location.href = data.url;
    } finally {
      setLoadingPack(null);
    }
  };

  const loadReceipts = async () => {
    setReceiptsLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;

      const { data, error } = await supabase
        .from("credit_ledger")
        .select(
          "id,created_at,delta,reason,amount_total,currency,receipt_url,stripe_charge_id,stripe_payment_intent_id,stripe_session_id"
        )
        .eq("user_id", u.user.id)
        .gt("delta", 0)
        .order("created_at", { ascending: false })
        .limit(25);

      if (!error && data) setReceipts(data as ReceiptRow[]);
    } finally {
      setReceiptsLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state === "success") {
      const t = setTimeout(() => loadReceipts(), 1200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div style={{ maxWidth: 980 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: -0.4 }}>Vidéos</h2>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Choisis un pack pour ajouter des vidéos à ton compte.
          </div>
        </div>

        <button
          onClick={() => router.push("/app/library")}
          style={{
            padding: "10px 14px",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.14)",
            background: "rgba(0,0,0,0.88)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Aller à la bibliothèque
        </button>
      </div>

      {state !== "idle" && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.10)",
            background:
              state === "success"
                ? "rgba(16, 185, 129, 0.10)"
                : "rgba(245, 158, 11, 0.12)",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 14 }}>
            {state === "success" ? "✅ Paiement confirmé" : "⚠️ Paiement annulé"}
          </div>
          <div style={{ opacity: 0.85, marginTop: 6, fontSize: 13 }}>
            {state === "success"
              ? "Tes vidéos vont être ajoutées automatiquement (quelques secondes)."
              : "Aucun débit n’a été effectué. Tu peux réessayer quand tu veux."}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {state === "success" ? (
              <>
                <button
                  onClick={() => router.push("/app/library")}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.14)",
                    background: "rgba(0,0,0,0.88)",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Voir la bibliothèque
                </button>
                <button
                  onClick={() => router.replace("/app/credits")}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.14)",
                    background: "rgba(255,255,255,0.95)",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  OK
                </button>
              </>
            ) : (
              <button
                onClick={() => router.replace("/app/credits")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.14)",
                  background: "rgba(255,255,255,0.95)",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Revenir aux packs
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Card>
          <div style={{ padding: 16 }}>
            <div style={{ fontWeight: 900 }}>Packs de vidéos</div>
            <div style={{ opacity: 0.8, marginTop: 6 }}>
              Choisis un pack, puis finalise le paiement en toute sécurité.
            </div>

            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <PackCard title="À l’unité" price="10,90 € TTC" sub="1 vidéo" busy={loadingPack === "unit"} onClick={() => startCheckout("unit")} />
              <PackCard title="Pack 10" price="89 € TTC" sub="10 vidéos" busy={loadingPack === "pack10"} onClick={() => startCheckout("pack10")} />
              <PackCard title="Pack 20" price="169 € TTC" sub="20 vidéos" busy={loadingPack === "pack20"} onClick={() => startCheckout("pack20")} />
              <PackCard title="Pack 40" price="309 € TTC" sub="40 vidéos" busy={loadingPack === "pack40"} onClick={() => startCheckout("pack40")} />
            </div>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900 }}>Historique des achats</div>
                <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
                  Retrouve tes paiements et télécharge tes reçus.
                </div>
              </div>

              <button
                onClick={loadReceipts}
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.14)",
                  background: "rgba(0,0,0,0.88)",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Actualiser
              </button>
            </div>

            {receiptsLoading ? (
              <div style={{ marginTop: 12, opacity: 0.75 }}>Chargement…</div>
            ) : receipts.length === 0 ? (
              <div style={{ marginTop: 12, opacity: 0.75 }}>Aucun achat pour l’instant.</div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {receipts.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      border: "1px solid rgba(0,0,0,0.10)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(0,0,0,0.02)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900 }}>
                        {fmtMoney(r.amount_total, r.currency)}{" "}
                        <span style={{ opacity: 0.7, fontWeight: 700 }}>• +{r.delta} vidéo(s)</span>
                      </div>
                      <div style={{ marginTop: 4, opacity: 0.75, fontSize: 13 }}>
                        {fmtDate(r.created_at)} • {friendlyReason(r.reason)}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      {r.receipt_url ? (
                        <a
                          href={r.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: "10px 14px",
                            borderRadius: 14,
                            border: "1px solid rgba(0,0,0,0.14)",
                            background: "rgba(255,255,255,0.95)",
                            textDecoration: "none",
                            color: "#111",
                            fontWeight: 900,
                          }}
                        >
                          Télécharger le reçu ↗
                        </a>
                      ) : (
                        <div style={{ opacity: 0.7, fontSize: 13 }}>Reçu indisponible</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function PackCard({
  title,
  price,
  sub,
  busy,
  onClick,
}: {
  title: string;
  price: string;
  sub: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        textAlign: "left",
        padding: 14,
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "rgba(255,255,255,0.95)",
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.75 : 1,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 14 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900 }}>{price}</div>
      <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>{sub}</div>
      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 900, opacity: 0.9 }}>
        {busy ? "Ouverture…" : "Continuer →"}
      </div>
    </button>
  );
}
