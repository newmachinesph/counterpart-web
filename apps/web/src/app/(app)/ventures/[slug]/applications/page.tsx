import { Button, Empty, Notice, PageHeader, Pill, type Tone } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { templateById } from "@/lib/domain/equity";
import type { ApplicationStatus } from "@/lib/domain/types";
import { formatDate, formatPct } from "@/lib/format";
import { listApplicationsForVenture } from "@/lib/services/applications";
import { canManageVenture, getVentureBySlug, isOnBench } from "@/lib/services/ventures";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { reviewAction } from "./actions";

export const metadata: Metadata = { title: "Applications" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<ApplicationStatus, Tone> = {
  submitted: "blue",
  shortlisted: "blue",
  declined: "gray",
  invited: "green",
};

export default async function ApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const user = await requireRole("builder", `/ventures/${slug}/applications`);
  const venture = (await getVentureBySlug(slug));
  if (!venture || !canManageVenture(user, venture)) notFound();

  const queue = (await listApplicationsForVenture(user, venture));
  const live = !(await isOnBench(venture));
  const termsPending = !venture.commercialTerms?.contractingParty;
  const error = typeof query.error === "string" ? query.error : null;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Applications for ${venture.name}`}
        description={
          <>
            Read the evidence, then shortlist, decline, or invite to a proving run. Declines send a
            templated email.{" "}
            <Link href={`/bench/${slug}`} className="underline text-fg">
              Venture page
            </Link>
            .
          </>
        }
      />
      {error ? (
        <div className="mb-4">
          <Notice tone="red">{error}</Notice>
        </div>
      ) : null}
      {live ? (
        <div className="mb-4">
          <Notice tone="blue">
            This venture is not open for a new pairing. You can still shortlist or decline applications.
          </Notice>
        </div>
      ) : null}

      {termsPending && <Notice>Applications are open for review. Complete the paid commercial terms before sending an offer.</Notice>}
      {queue.length === 0 ? (
        <Empty>No applications yet.</Empty>
      ) : (
        <ul className="flex flex-col gap-4">
          {queue.map(({ application: a, applicant }) => {
            const decided = a.status === "declined" || a.status === "invited";
            return (
              <li key={a.id} className="rounded-lg border border-line p-4 sm:p-5 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{applicant.name}</div>
                    <div className="text-sm text-muted tnum">
                      Applied {formatDate(a.submittedAt)}. {a.hoursPerWeek} hours a week.{" "}
                      {a.compensation === "cash" ? "Paid commercial engagement." : "Historical compensation request; a new offer requires agreed cash terms."}
                    </div>
                  </div>
                  <Pill tone={STATUS_TONE[a.status]}>{a.status}</Pill>
                </div>

                <Section title="The ask">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={a.track === "intern" ? "blue" : "neutral"}>{a.track}</Pill>
                    <span className="font-medium tnum">{a.compensation === "cash" ? "Paid commercial engagement; exact terms agreed in the offer" : formatPct(a.requestedEquityPct)}</span>
                    <span className="text-muted">as {templateById(a.templateId)?.name ?? a.templateId}</span>
                    {a.acknowledgesResourceClause ? <Pill tone="green">Resource clause acknowledged</Pill> : null}
                  </div>
                  {a.commitments.length ? (
                    <ul className="mt-2 flex flex-col gap-1">
                      {a.commitments.map((c) => <li key={c}>Brings: {c}</li>)}
                    </ul>
                  ) : null}
                </Section>

                <Section title="Sold, grown, or launched">                  <p className="whitespace-pre-line">{a.evidence}</p>
                </Section>

                <Section title="Numbers moved">
                  <table className="w-full text-sm tnum">
                    <thead className="text-xs text-muted text-left">
                      <tr>
                        <th className="font-medium pb-1">Metric</th>
                        <th className="font-medium pb-1">Before</th>
                        <th className="font-medium pb-1">After</th>
                        <th className="font-medium pb-1">Timeframe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.numbersMoved.map((n, i) => (
                        <tr key={i} className="border-t border-line">
                          <td className="py-1 pr-2">{n.metric}</td>
                          <td className="py-1 pr-2">{n.before}</td>
                          <td className="py-1 pr-2 font-medium">{n.after}</td>
                          <td className="py-1">{n.timeframe}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>

                <Section title="Proof">
                  <ul className="flex flex-col gap-1">
                    {a.proofLinks.map((l) => (
                      <li key={l}>
                        <a href={l} target="_blank" rel="noreferrer" className="underline break-all">
                          {l}
                        </a>
                      </li>
                    ))}
                  </ul>
                </Section>

                <Section title="Why this venture">
                  <p>{a.whyThisVenture}</p>
                </Section>

                {!decided ? (
                  <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                    {a.status !== "shortlisted" ? (
                      <form action={reviewAction}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="applicationId" value={a.id} />
                        <input type="hidden" name="action" value="shortlist" />
                        <Button type="submit" variant="secondary">
                          Shortlist
                        </Button>
                      </form>
                    ) : null}
                    <form action={reviewAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="applicationId" value={a.id} />
                      <input type="hidden" name="action" value="invite" />
                      <Button type="submit" disabled={live || termsPending}>
                        Send paid engagement offer
                      </Button>
                    </form>
                    <form action={reviewAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="applicationId" value={a.id} />
                      <input type="hidden" name="action" value="decline" />
                      <Button type="submit" variant="danger">
                        Decline
                      </Button>
                    </form>
                  </div>
                ) : (
                  <div className="text-sm text-muted border-t border-line pt-4 tnum">
                    {a.status === "invited" ? "Invited" : "Declined"} {formatDate(a.decidedAt)}.
                    {a.status === "declined" ? " An email update was queued." : ""}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted mb-1">{title}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
