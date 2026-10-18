import { Empty, PageHeader, Pill, type Tone } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getStore } from "@/lib/data/store";
import { pairingDayCount } from "@/lib/domain/pairing";
import type { PairingState } from "@/lib/domain/types";
import { PAIRING_STATE_LABELS, formatDate } from "@/lib/format";
import { listPairingsForUser, syncPairing } from "@/lib/services/pairings";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Pairings" };
export const dynamic = "force-dynamic";

export const STATE_TONE: Record<PairingState, Tone> = {
  offered: "blue", declined: "gray", cofounder: "green",
  proving_run: "blue",
  active: "green",
  completed: "green",
  released: "gray",
  lapsed: "red",
};

export default async function PairingsPage() {
  const user = await requireUser("/pairings");
  const now = new Date();
  const pairings = await Promise.all((await listPairingsForUser(user)).map(async (p) => (await syncPairing(p.id, now))));
  const store = (await getStore());
  const isAdmin = user.roles.includes("admin");

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={isAdmin ? "All pairings" : "Your pairings"}
        description="Each pairing has a dashboard with the milestones, the traction ledger, and vested equity."
      />
      {pairings.length === 0 ? (
        <Empty>
          No pairings yet.{" "}
          <Link href="/bench" className="underline text-fg">
            The Bench
          </Link>{" "}
          is where they start.
        </Empty>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {pairings.map((p) => {
            const venture = store.ventures.find((v) => v.id === p.ventureId);
            const counterpart = store.users.find((u) => u.id === p.counterpartId);
            const builder = store.users.find((u) => u.id === p.builderId);
            return (
              <li key={p.id} className="py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Link href={`/pairings/${p.id}`} className="font-medium hover:underline">
                    {venture?.name ?? "Venture"}
                  </Link>
                  <div className="text-sm text-muted">
                    {builder?.name} and {counterpart?.name}. Started {formatDate(p.startedAt)}.
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm text-muted tnum hidden sm:inline">
                    Day {pairingDayCount(p, now)}
                  </span>
                  <Pill tone={STATE_TONE[p.state]}>{PAIRING_STATE_LABELS[p.state]}</Pill>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}