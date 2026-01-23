import { Suspense } from "react";
import CreditsClient from "./CreditsClient";

export default function CreditsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, opacity: 0.75 }}>Chargement…</div>}>
      <CreditsClient />
    </Suspense>
  );
}
