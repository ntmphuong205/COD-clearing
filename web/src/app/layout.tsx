import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/app";
import { Banner } from "@/components/Banner";

const inter = Inter({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = { title: "COD Clearing", description: "One shared, verifiable COD balance across carriers" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <Banner />
          <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
