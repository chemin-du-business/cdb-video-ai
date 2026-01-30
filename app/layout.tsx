import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
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
      {/* TikTok Pixel Code Start */}
      <Script id="tiktok-pixel" strategy="afterInteractive">
        {`
          !function (w, d, t) {
            w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
          var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
          ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
            ttq.load('D5U7FL3C77UECCBSGHT0');
            ttq.page();
          }(window, document, 'ttq');
        `}
      </Script>
      {/* TikTok Pixel Code End */}

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
