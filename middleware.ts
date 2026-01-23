import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 🔓 Routes publiques (NE JAMAIS BLOQUER)
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/check-email") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // 🔐 On protège uniquement /app
  if (!pathname.startsWith("/app")) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 🧪 DEBUG (tu peux laisser pour l’instant)
  console.log(
    "cookies:",
    req.cookies.getAll().map((c) => c.name)
  );
  console.log("session?", !!session);

  // ❌ Pas connecté → login
  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ❌ Email non confirmé (email/password uniquement)
  if (!session.user.email_confirmed_at) {
    const checkUrl = req.nextUrl.clone();
    checkUrl.pathname = "/check-email";
    return NextResponse.redirect(checkUrl);
  }

  // ✅ Tout est OK
  return res;
}

// ⚠️ Très important
export const config = {
  matcher: ["/app/:path*"],
};
