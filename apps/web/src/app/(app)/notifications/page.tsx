import { Button, Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { listNotifications } from "@/lib/services/notifications";
import { markReadAction } from "./actions";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const items = (await listNotifications(user.id));
  const unreadIds = new Set(items.filter((n) => !n.readAt).map((n) => n.id));


  return (
    <div className="max-w-2xl">
      <PageHeader title="Notifications" description="Milestones clearing or missing, pairing changes, review requests." />
      {unreadIds.size > 0 ? <form action={markReadAction} className="mb-4"><Button type="submit" variant="secondary">Mark all as read</Button></form> : null}
      {items.length === 0 ? (
        <Empty>Nothing yet.</Empty>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((n) => (
            <li key={n.id} className="py-3 flex gap-3">
              <span className={`mt-2 h-1.5 w-1.5 rounded-full shrink-0 ${unreadIds.has(n.id) ? "bg-blue" : "bg-transparent"}`} />
              <div className="min-w-0">
                <div className="text-sm">{n.href ? <Link href={n.href} className="hover:underline">{n.body}</Link> : n.body}</div>
                <div className="text-xs text-muted tnum">{formatDate(n.createdAt)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}


    </div>
  );
}
