import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Footer } from "@/components/footer";
import { MotionProvider } from "@/components/motion";
import { Nav } from "@/components/nav";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  axes: ["opsz"],
});

const serif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: { default: "Counterpart", template: "%s · Counterpart" },
  description:
    "The open front door to Philippine startups. Builders list products that already work. Commercial partners agree paid trials, fees, and sales commissions. Cofounder equity requires a separate agreement.",
  metadataBase: new URL("https://counterpart.ph"),
  // Next.js inherits each page's title and description for social previews.
  openGraph: {
    type: "website",
    siteName: "Counterpart",
    locale: "en_PH",
    url: "./",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "Counterpart — A working product meets the person who can sell it.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      {
        url: "/og-image.png",
        alt: "Counterpart — A working product meets the person who can sell it.",
      },
    ],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <MotionProvider>
          <Nav />
          <main className="flex-1 w-full">{children}</main>
          <SiteFooter><Footer /></SiteFooter>
        </MotionProvider>
      </body>
    </html>
  );
}
