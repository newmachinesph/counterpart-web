"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isWorkspacePath } from "@/lib/workspace-navigation";

export function SiteFooter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!isWorkspacePath(pathname)) return children;
  return <footer className="mt-auto border-t border-line"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-muted sm:px-6"><span>Counterpart 2026</span><nav aria-label="Workspace resources" className="flex gap-5"><Link href="/support">Support</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></nav></div></footer>;
}
