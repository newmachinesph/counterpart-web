import { JobCard } from "@/components/job-card";
import { Button, Empty, INPUT_CLASS, LinkButton, PageHeader } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { ARRANGEMENT_LABELS, OPENING_TYPE_LABELS } from "@/lib/domain/openings";
import { OPENING_TYPES, WORK_ARRANGEMENTS, type OpeningType, type WorkArrangement } from "@/lib/domain/types";
import { listOpenings, postableVentures, type OpeningFilters } from "@/lib/services/openings";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Jobs" };
export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function JobsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const user = await getSession();
  const who = str(params.who);
  const type = str(params.type);
  const arrangement = str(params.arrangement);
  const filters: OpeningFilters = {
    type: (OPENING_TYPES as readonly string[]).includes(type) ? (type as OpeningType) : null,
    arrangement: (WORK_ARRANGEMENTS as readonly string[]).includes(arrangement) ? (arrangement as WorkArrangement) : null,
    counterpartOnly: who === "counterpart",
    paidOnly: str(params.paid) === "1",
  };
  const all = (await listOpenings(filters));
  const cards = who === "ventures" ? all.filter((c) => c.venture !== null) : all;
  const canPost = user ? (await postableVentures(user)).length > 0 || user.roles.includes("admin") : false;
  const anyFilter = who || type || arrangement || str(params.paid);

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Paid roles at ventures on the Bench, and at Counterpart itself. Every paid role says where the money comes from, and a venture role funded by revenue shows the figure its traction ledger actually recorded."
        aside={canPost ? <LinkButton href="/jobs/new">Post a role</LinkButton> : null}
      />

      <form method="get" className="mb-6 grid gap-3 sm:grid-cols-5 sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Employer</span>
          <select name="who" defaultValue={who} className={INPUT_CLASS}>
            <option value="">Everyone</option>
            <option value="ventures">Ventures</option>
            <option value="counterpart">Counterpart</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Type</span>
          <select name="type" defaultValue={type} className={INPUT_CLASS}>
            <option value="">Any</option>
            {OPENING_TYPES.map((t) => (
              <option key={t} value={t}>{OPENING_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Arrangement</span>
          <select name="arrangement" defaultValue={arrangement} className={INPUT_CLASS}>
            <option value="">Any</option>
            {WORK_ARRANGEMENTS.map((a) => (
              <option key={a} value={a}>{ARRANGEMENT_LABELS[a]}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm sm:pb-2.5">
          <input type="checkbox" name="paid" value="1" defaultChecked={str(params.paid) === "1"} />
          Paid roles only
        </label>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="flex-1">Filter</Button>
          {anyFilter ? <LinkButton href="/jobs" variant="secondary">Clear</LinkButton> : null}
        </div>
      </form>

      {cards.length === 0 ? (
        <Empty>No roles match. Ventures post here when the ledger can pay for help.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <JobCard key={card.opening.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}