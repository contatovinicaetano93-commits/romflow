import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://romflow.vercel.app"),
  title: "ROM FLOW — Fluxo de despesas",
  description:
    "Solicitações, aprovações e pagamentos em um único fluxo. Controle financeiro inteligente do Grupo ROM.",
  authors: [{ name: "Grupo ROM" }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ROM Flow",
  },
  openGraph: {
    title: "ROM FLOW",
    description: "Fluxo de despesas do Grupo ROM",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
