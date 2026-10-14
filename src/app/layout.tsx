import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Aviso } from "@/components/form";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Financeiro",
  description: "Financeiro da Clados e da Casa",
  applicationName: "Financeiro",
  appleWebApp: { capable: true, title: "Financeiro", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: "/icone-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f5f2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        {children}
        <Aviso />
      </body>
    </html>
  );
}
