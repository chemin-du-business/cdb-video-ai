import { Suspense } from "react";
import CheckEmailClient from "./CheckEmailClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-black/60">Chargement…</div>}>
      <CheckEmailClient />
    </Suspense>
  );
}
