import { Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getStore } from "@/lib/data/store";
import { weekCloseAt, weekStartOf } from "@/lib/domain/ledger";
import { isTerminalState } from "@/lib/domain/pairing";
import { formatDate } from "@/lib/format";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadDashboardOr404 } from "../load";
import { LogForm } from "./log-form";

export const metadata: Metadata = { title: "Log this week" };
export const dynamic = "force-dynamic";

export default async function LogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/pairings/${id}/log`);
  const now = new Date();
  const d = await loadDashboardOr404(user, id, now);
  if (user.id !== d.pairing.counterpartId) redirect(`/pairings/${id}?error=${encodeURIComponent("Only the Counterpart logs the ledger")}`);
  if (isTerminalState(d.pairing.state) || d.pairing.state === "offered") redirect(`/pairings/${id}`);
  const metrics = d.pairing.agreement?.metrics ?? d.venture.metrics;

  const thisWeek = weekStartOf(now);
  const existing = (await getStore()).ledgerEntries.find((e) => e.pairingId === id && e.weekStarting === thisWeek) ?? null;

  return (
    <div className="max-w-xl">
      <PageHeader
        title={`Week of ${formatDate(thisWeek)}`}
        description={
          <>
            {d.venture.name}. One entry per week. You can edit it until the week closes on{" "}
            <span className="tnum">{formatDate(weekCloseAt(thisWeek).toISOString())}</span>. After that it is read-only.{" "}
            <Link href={`/pairings/${id}`} className="underline text-fg">Back to the dashboard</Link>.
          </>
        }
      />
      {d.openMilestone ? (
        <div className="mb-6">
          <Notice tone="blue">
            Performance goal: {d.openMilestone.title}. Reported target: {metrics.find((m) => m.key === d.openMilestone?.metricKey)?.label ?? d.openMilestone.metricKey} reaches {d.openMilestone.targetValue}. This does not grant equity or confirm payment.
          </Notice>
        </div>
      ) : null}
      <LogForm pairingId={id} weekStarting={thisWeek} metrics={metrics} existing={existing} />
    </div>
  );
}
