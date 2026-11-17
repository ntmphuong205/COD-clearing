import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/app";
import { Banner } from "@/components/Banner";
import { ToastHost } from "@/components/ToastHost";
import { GuideBar } from "@/components/sim/GuideBar";

const inter = Inter({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = { title: "COD Clearing", description: "One shared, verifiable COD balance across carriers" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#070b14" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          <Banner />
          <main className="mx-auto max-w-4xl px-4 py-6 pb-28">{children}</main>
          <ToastHost />
          <GuideBar />
        </Providers>
      </body>
    </html>
  );
}
