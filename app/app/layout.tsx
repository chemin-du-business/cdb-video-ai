"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCredits } from "@/lib/useCredits";
import JobPoller from "./_components/JobPoller";
import { useEffect, useMemo, useState } from "react";

const nav = [
  { href: "/app/generate", label: "Générer", icon: "✨" },
  { href: "/app/library", label: "Bibliothèque", icon: "🎬" },
  { href: "/app/account", label: "Compte", icon: "⚙️" },
  { href: "/app/credits", label: "Crédits", icon: "💳" },
];

function NavItem({
  href,
  label,
  icon,
  onClick,
  collapsed,
}: {
  href: string;
  label: string;
  icon: string;
  onClick?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={[
        "group flex items-center rounded-xl text-sm font-semibold transition",
        "overflow-hidden", // ✅ empêche le texte de dépasser
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
        active
          ? "bg-black/[0.06] text-black ring-1 ring-black/15"
          : "text-black/75 hover:bg-black/[0.04] hover:text-black",
      ].join(" ")}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/[0.03] ring-1 ring-black/10 group-hover:bg-black/[0.05]">
        <span className="text-base leading-none">{icon}</span>
      </span>

      {/* ✅ IMPORTANT: on cache le label quand collapsed */}
      {!collapsed && <span className="truncate">{label}</span>}

      {/* ✅ petit point actif seulement en mode normal */}
      {!collapsed && active && <span className="ml-auto h-2 w-2 rounded-full bg-black/60" />}
    </Link>
  );
}

function useIsDesktop(bpPx = 1024) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width:${bpPx}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [bpPx]);

  return isDesktop;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { credits, loading } = useCredits();

  const isDesktop = useIsDesktop(1024);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const pathname = usePathname();
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  const sidebarWidth = useMemo(() => {
    if (!isDesktop) return 320;
    return desktopCollapsed ? 92 : 288;
  }, [isDesktop, desktopCollapsed]);

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Background (chat-like) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_10%_0%,rgba(0,0,0,0.06),transparent_60%),radial-gradient(1200px_600px_at_90%_0%,rgba(0,0,0,0.05),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.03),transparent_35%)]" />
      </div>

      <JobPoller />

      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white/80 text-black/80 shadow-sm transition hover:bg-black/[0.04] lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <span className="block h-4 w-5">
              <span className="block h-[2px] w-5 rounded bg-black/70" />
              <span className="mt-1.5 block h-[2px] w-5 rounded bg-black/60" />
              <span className="mt-1.5 block h-[2px] w-5 rounded bg-black/50" />
            </span>
          </button>

          <Link href="/app/library" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-black/[0.03]">
              <span className="text-sm font-extrabold">CDB</span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold tracking-tight">CDB Video IA</div>
              <div className="truncate text-[11px] font-medium text-black/50">Arcade-like · Sora</div>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/app/credits"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-black/70 hover:bg-black/[0.04]"
            >
              <span className="text-[11px] text-black/50">Crédits</span>
              <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] text-black/80">
                {loading ? "…" : `${credits ?? 0}`}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Container */}
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {/* Desktop */}
        <div
          className="hidden lg:grid lg:items-start lg:gap-6"
          style={{ gridTemplateColumns: `${sidebarWidth}px 1fr` }}
        >
          {/* Sidebar */}
          <aside className="sticky top-[88px] self-start">
            <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/80 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.25)] backdrop-blur">
              <div className="flex items-center justify-between gap-2 border-b border-black/10 p-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl border border-black/10 bg-black/[0.03]">
                    <span className="text-xs font-extrabold">CDB</span>
                  </div>

                  {!desktopCollapsed && (
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold tracking-tight">CDB Video IA</div>
                      <div className="truncate text-[11px] font-medium text-black/50">Workspace</div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setDesktopCollapsed((v) => !v)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white/80 text-black/70 hover:bg-black/[0.04]"
                  aria-label={desktopCollapsed ? "Agrandir la barre latérale" : "Réduire la barre latérale"}
                  title={desktopCollapsed ? "Agrandir" : "Réduire"}
                >
                  <span className={["transition-transform", desktopCollapsed ? "rotate-180" : ""].join(" ")}>
                    ←
                  </span>
                </button>
              </div>

              <div className="p-2">
                <div className="grid gap-1">
                  {nav.map((item) => (
                    <NavItem key={item.href} {...item} collapsed={desktopCollapsed} />
                  ))}
                </div>
              </div>

              <div className="border-t border-black/10 p-3">
                <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-3">
                  {!desktopCollapsed ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-extrabold text-black/80">Mon solde</div>
                        <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-semibold text-black/70">
                          {loading ? "…" : `${credits ?? 0} crédit(s)`}
                        </span>
                      </div>

                      <Link
                        href="/app/credits"
                        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full bg-black px-4 text-sm font-semibold text-white hover:bg-black/90"
                      >
                        Acheter des crédits
                      </Link>
                    </>
                  ) : (
                    <Link
                      href="/app/credits"
                      className="inline-flex h-10 w-full items-center justify-center rounded-full bg-black text-sm font-semibold text-white hover:bg-black/90"
                      title="Acheter des crédits"
                    >
                      💳
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* Content */}
          <main className="min-h-[calc(100vh-140px)] rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.25)] backdrop-blur sm:p-6">
            {children}
          </main>
        </div>

        {/* Mobile */}
        <main className="lg:hidden min-h-[calc(100vh-180px)] rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.25)] backdrop-blur sm:p-6">
          {children}
        </main>
      </div>

      {/* Mobile Drawer */}
      <div className={["fixed inset-0 z-50 lg:hidden", mobileOpen ? "" : "pointer-events-none"].join(" ")}>
        <div
          onClick={() => setMobileOpen(false)}
          className={[
            "absolute inset-0 bg-black/30 transition-opacity",
            mobileOpen ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />

        <aside
          className={[
            "absolute left-0 top-0 h-full w-[85%] max-w-[340px] border-r border-black/10 bg-white/90 shadow-2xl backdrop-blur transition-transform",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="flex items-center justify-between gap-2 border-b border-black/10 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-black/[0.03]">
                <span className="text-sm font-extrabold">CDB</span>
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold tracking-tight">CDB Video IA</div>
                <div className="truncate text-[11px] font-medium text-black/50">Menu</div>
              </div>
            </div>

            <button
              onClick={() => setMobileOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white/80 text-black/70 hover:bg-black/[0.04]"
              aria-label="Fermer le menu"
            >
              ✕
            </button>
          </div>

          <div className="p-3">
            <div className="grid gap-1">
              {nav.map((item) => (
                <NavItem key={item.href} {...item} onClick={() => setMobileOpen(false)} />
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-black/80">Mon solde</div>
                <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-semibold text-black/70">
                  {loading ? "…" : `${credits ?? 0} crédit(s)`}
                </span>
              </div>

              <Link
                href="/app/credits"
                onClick={() => setMobileOpen(false)}
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full bg-black px-4 text-sm font-semibold text-white hover:bg-black/90"
              >
                Acheter des crédits
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
