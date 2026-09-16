import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://romflow.com.br"),
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
    <html lang="pt-BR" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
