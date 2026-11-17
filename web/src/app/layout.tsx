import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/lib/app";
import { Banner } from "@/components/Banner";

export const metadata: Metadata = { title: "COD Clearing", description: "One shared, verifiable COD balance across carriers" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Banner />
          <main className="max-w-3xl mx-auto px-3 py-4">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
