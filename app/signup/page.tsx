import { Suspense } from "react";
import SignupClient from "./SignupClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-black/60">Chargement…</div>}>
      <SignupClient />
    </Suspense>
  );
}
