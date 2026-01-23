import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inscription",
  description:
    "Crée ton compte CDB Video IA et commence à générer des vidéos verticales UGC avec l’IA en quelques minutes.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
