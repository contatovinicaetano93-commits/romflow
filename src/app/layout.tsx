import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://romflow.goskip.app"),
  title: "ROM FLOW — Fluxo de despesas",
  description:
    "Solicitações, aprovações e pagamentos em um único fluxo. Controle financeiro inteligente do Grupo ROM.",
  authors: [{ name: "Grupo ROM" }],
  openGraph: {
    title: "ROM FLOW",
    description: "Fluxo de despesas do Grupo ROM",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
