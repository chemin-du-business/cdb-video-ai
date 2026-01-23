import { Suspense } from "react";
import CheckEmailVerifiedClient from "./CheckEmailVerifiedClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-black/60">Finalisation…</div>}>
      <CheckEmailVerifiedClient />
    </Suspense>
  );
}
