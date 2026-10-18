import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LegalLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">{children}</div>;
}
