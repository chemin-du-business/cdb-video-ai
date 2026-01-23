import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-black/60">Chargement…</div>}>
      <LoginClient />
    </Suspense>
  );
}
