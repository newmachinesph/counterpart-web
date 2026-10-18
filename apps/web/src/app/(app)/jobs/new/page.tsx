import { Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { ledgerRevenueFor, postableVentures } from "@/lib/services/openings";
import type { Metadata } from "next";
import { OpeningForm } from "./opening-form";

export const metadata: Metadata = { title: "Post a role" };
export const dynamic = "force-dynamic";

export default async function NewOpeningPage() {
  const user = await requireUser("/jobs/new");
  const ventures = await Promise.all((await postableVentures(user)).map(async (v) => ({ id: v.id, name: v.name, ledgerRevenuePhp: (await ledgerRevenueFor(v.id)) })));
  const canPostForCounterpart = user.roles.includes("admin");

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Post a role"
        description="A paid role has to say where the money comes from. If it comes from revenue, the traction ledger has to show it."
      />
      {ventures.length === 0 && !canPostForCounterpart ? (
        <Notice tone="gray">
          You can post a role for a venture you build, or for one where you hold the Counterpart seat. You have neither right now.
        </Notice>
      ) : (
        <OpeningForm ventures={ventures} canPostForCounterpart={canPostForCounterpart} />
      )}
    </div>
  );
}