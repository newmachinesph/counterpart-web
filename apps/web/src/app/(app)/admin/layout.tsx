import Link from "next/link";
import { requireRole } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin", "/admin");
  return <>
    <nav aria-label="Administration" className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line pb-4 text-sm">
      <span className="mr-auto font-medium text-brand">Counterpart administration</span>
      <Link className="hover:underline" href="/admin">Operations</Link>
      <Link className="hover:underline" href="/admin/email-queue">Email delivery</Link>
      <Link className="hover:underline" href="/ventures">Ventures</Link>
    </nav>
    {children}
  </>;
}
