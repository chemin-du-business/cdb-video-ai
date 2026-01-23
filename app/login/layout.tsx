import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion",
  description:
    "Connecte-toi à CDB Video IA pour créer et gérer tes vidéos verticales UGC générées par l’IA.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
