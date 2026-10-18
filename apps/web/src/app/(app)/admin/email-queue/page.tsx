import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui";
import { EmailQueue } from "./queue";

export default async function QueuePage() {
  await requireRole("admin", "/admin/email-queue");
  return <><PageHeader title="Email delivery" description="Schedule messages, inspect delivery attempts, and retry failed jobs." /><EmailQueue /></>;
}
