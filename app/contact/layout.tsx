import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Une question ou besoin d’aide ? Contacte l’équipe CDB Video IA.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
