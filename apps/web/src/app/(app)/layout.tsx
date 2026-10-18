import type { ReactNode } from "react";

/** Application screens share one measure. Marketing pages set their own. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">{children}</div>;
}