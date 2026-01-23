import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CDB Video IA",
    template: "%s | CDB Video IA",
  },
  description:
    "Crée des vidéos verticales avec l’IA (UGC) : script, montage, sous-titres et export en quelques minutes.",
  applicationName: "CDB Video IA",
  openGraph: {
    type: "website",
    siteName: "CDB Video IA",
    title: "CDB Video IA",
    description:
      "Crée des vidéos verticales avec l’IA (UGC) : script, montage, sous-titres et export en quelques minutes.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CDB Video IA",
    description:
      "Crée des vidéos verticales avec l’IA (UGC) : script, montage, sous-titres et export en quelques minutes.",
  },
};

// ✅ IMPORTANT pour mobile (App Router)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full">
      <body
        className={[
          geistSans.variable,
          geistMono.variable,
          "h-full min-h-screen antialiased",
          "bg-white text-black",
          "overflow-x-hidden", // ✅ évite les débordements sur mobile
          "scroll-smooth",
        ].join(" ")}
      >
        {children}
      </body>
    </html>
  );
}
