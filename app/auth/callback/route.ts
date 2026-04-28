// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const next = url.searchParams.get("next") || "/app";
  const code = url.searchParams.get("code");

  const token_hash =
    url.searchParams.get("token_hash") ?? url.searchParams.get("token");

  const type = url.searchParams.get("type") as
    | "signup"
    | "invite"
    | "magiclink"
    | "recovery"
    | "email_change"
    | null;

  let res = NextResponse.redirect(new URL(next, url.origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // ✅ 1) Flow verify email / recovery : INCHANGÉ
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (error) {
      const errUrl = new URL("/login", url.origin);
      errUrl.searchParams.set("next", next);
      errUrl.searchParams.set("error", "verify_failed");
      return NextResponse.redirect(errUrl);
    }

    return res;
  }

  // ✅ 2) Flow OAuth Google : on ajoute juste FirstPromoter après
  if (code) {
    const fprUrl = new URL("/auth/fpr-callback", url.origin);
    fprUrl.searchParams.set("next", next);

    res = NextResponse.redirect(fprUrl);

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const errUrl = new URL("/login", url.origin);
      errUrl.searchParams.set("next", next);
      errUrl.searchParams.set("error", "oauth_failed");
      return NextResponse.redirect(errUrl);
    }

    return res;
  }

  const fallback = new URL("/login", url.origin);
  fallback.searchParams.set("next", next);
  fallback.searchParams.set("error", "missing_params");
  return NextResponse.redirect(fallback);
}
