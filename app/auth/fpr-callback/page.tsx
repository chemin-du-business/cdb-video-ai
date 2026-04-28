import { Suspense } from "react";
import FprCallbackClient from "./FprCallbackClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white text-black">
          <p className="text-sm text-black/60">Connexion en cours…</p>
        </div>
      }
    >
      <FprCallbackClient />
    </Suspense>
  );
}
