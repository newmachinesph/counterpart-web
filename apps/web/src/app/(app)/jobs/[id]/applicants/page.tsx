import { FundingLine } from "@/components/job-card";
import { Button, Empty, Notice, PageHeader, Pill, type Tone } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { payLabel } from "@/lib/domain/openings";
import type { JobApplicationStatus } from "@/lib/domain/types";
import { formatDate, formatPhp } from "@/lib/format";
import { canManageOpening, getOpeningCard, listApplicantsForOpening } from "@/lib/services/openings";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { reviewJobAction, setOpeningStatusAction } from "../../actions";

export const metadata: Metadata = { title: "Applicants" };
export const dynamic = "force-dynamic";

const TONE: Record<JobApplicationStatus, Tone> = { offered: "blue", submitted: "blue", shortlisted: "blue", declined: "gray", hired: "green" };

export default async function ApplicantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser(`/jobs/${id}/applicants`);
  const card = (await getOpeningCard(id));
  if (!card || !(await canManageOpening(user, card.opening))) notFound();
  const { opening, venture } = card;
  const queue = (await listApplicantsForOpening(user, id));
  const error = typeof query.error === "string" ? query.error : null;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Applicants: ${opening.title}`}
        description={
          <>
            {venture ? venture.name : "Counterpart"} · {payLabel(opening)} ·{" "}
            <Link href={`/jobs/${id}`} className="underline text-fg">the posting</Link>
          </>
        }
        aside={
          <form action={setOpeningStatusAction}>
            <input type="hidden" name="openingId" value={id} />
            <input type="hidden" name="status" value={opening.status === "open" ? "closed" : "open"} />
            <Button type="submit" variant="secondary">{opening.status === "open" ? "Close the role" : "Reopen the role"}</Button>
          </form>
        }
      />
      {error ? <div className="mb-4"><Notice tone="red">{error}</Notice></div> : null}
      <div className="mb-6"><Notice tone="neutral"><FundingLine card={card} /></Notice></div>

      {queue.length === 0 ? (
        <Empty>Nobody has applied yet.</Empty>
      ) : (
        <ul className="flex flex-col gap-4">
          {queue.map(({ application: a, applicant }) => {
            const decided = a.status === "declined" || a.status === "hired";
            return (
              <li key={a.id} className="rounded-2xl border border-line p-5 flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{applicant.name}</div>
                    <div className="text-sm text-muted">{applicant.headline}</div>
                    <div className="text-sm text-muted tnum mt-0.5">
                      Applied {formatDate(a.submittedAt)} · available {formatDate(a.availableFrom)}
                      {a.expectedSalaryPhpMonthly !== null ? ` · asks ${formatPhp(a.expectedSalaryPhpMonthly)} a month` : ""}
                    </div>
                  </div>
                  <Pill tone={TONE[a.status]}>{a.status}</Pill>
                </div>

                <div>
                  <div className="text-xs text-muted mb-1">What they have done</div>
                  <p className="text-sm whitespace-pre-line">{a.evidence}</p>
                </div>
                <div>
                  <div className="text-xs text-muted mb-1">Proof</div>
                  <ul className="text-sm flex flex-col gap-1">
                    {a.proofLinks.map((l) => (
                      <li key={l}><a href={l} target="_blank" rel="noreferrer" className="underline break-all">{l}</a></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs text-muted mb-1">Why this role</div>
                  <p className="text-sm">{a.whyThisRole}</p>
                </div>

                {decided ? (
                  <div className="text-sm text-muted border-t border-line pt-4 tnum">
                    {a.status === "hired" ? "Accepted" : a.status === "offered" ? "Offer pending acceptance" : "Declined"} {formatDate(a.decidedAt)}.
                    {a.status === "declined" ? " An email update was queued." : ""}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                    {a.status !== "shortlisted" ? (
                      <form action={reviewJobAction}>
                        <input type="hidden" name="openingId" value={id} />
                        <input type="hidden" name="applicationId" value={a.id} />
                        <input type="hidden" name="action" value="shortlist" />
                        <Button type="submit" variant="secondary">Shortlist</Button>
                      </form>
                    ) : null}
                    <form action={reviewJobAction}>
                      <input type="hidden" name="openingId" value={id} />
                      <input type="hidden" name="applicationId" value={a.id} />
                      <input type="hidden" name="action" value="hire" />
                      <Button type="submit">Offer role at advertised minimum pay</Button>
                    </form>
                    <form action={reviewJobAction}>
                      <input type="hidden" name="openingId" value={id} />
                      <input type="hidden" name="applicationId" value={a.id} />
                      <input type="hidden" name="action" value="decline" />
                      <Button type="submit" variant="danger">Decline</Button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
