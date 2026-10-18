import { FundingLine } from "@/components/job-card";
import { Button, Card, LinkButton, Notice, PageHeader, Pill, SectionTitle } from "@/components/ui";
import { respondToJobAction } from "../actions";
import { getSession } from "@/lib/auth/session";
import { ARRANGEMENT_LABELS, OPENING_TYPE_LABELS, payLabel } from "@/lib/domain/openings";
import { formatDate, pluralize } from "@/lib/format";
import { canManageOpening, findJobApplication, getOpeningCard } from "@/lib/services/openings";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: (await getOpeningCard(id))?.opening.title ?? "Role" };
}

export default async function JobPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const card = (await getOpeningCard(id));
  if (!card) notFound();
  const { opening, venture, applicantCount } = card;
  const user = await getSession();
  const mine = user ? (await canManageOpening(user, opening)) : false;
  const existing = user ? (await findJobApplication(opening.id, user.id)) : null;

  return (
    <div className="max-w-3xl flex flex-col gap-8">
      {query.error && <Notice tone="red">{String(query.error)}</Notice>}
      {query.saved && <Notice tone="green">Your response is recorded.</Notice>}
      {existing?.status === "offered" && existing.offerSnapshot && <Card>
        <SectionTitle>Your saved job offer</SectionTitle>
        <p>PHP {Number(existing.offerSnapshot.salaryPhpMonthly).toLocaleString("en-PH")} per month</p>
        <p className="my-3 whitespace-pre-line">{String(existing.offerSnapshot.compensationDetails)}</p>
        <p className="mb-3 text-sm text-muted">Review these working terms before accepting. Acceptance fills this opening; employment rights and any required employer documents still apply.</p>
        <form action={respondToJobAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="openingId" value={id} /><input type="hidden" name="applicationId" value={existing.id} />
          <input type="hidden" name="agreementHash" value={existing.offerSnapshot.hash} />
          <Button name="action" value="hire">Accept saved offer</Button><Button name="action" value="decline" variant="secondary">Decline</Button>
        </form>
      </Card>}
      {query.applied === "1" ? <Notice tone="green">Application sent. They read every one and reply either way.</Notice> : null}
      {opening.status !== "open" ? <Notice tone="gray">This role is {opening.status}. It stays here for the record.</Notice> : null}

      <PageHeader
        title={opening.title}
        description={
          <>
            {venture ? (
              <>
                <Link href={`/bench/${venture.slug}`} className="underline text-fg">{venture.name}</Link> · {opening.team}
              </>
            ) : (
              <>Counterpart · {opening.team}</>
            )}
          </>
        }
        aside={
          <>
            <Pill tone="neutral">{OPENING_TYPE_LABELS[opening.type]}</Pill>
            <Pill tone="neutral">{ARRANGEMENT_LABELS[opening.arrangement]}</Pill>
            <Pill tone="neutral">{opening.location}</Pill>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-2xl font-medium tnum">{payLabel(opening)}</div>
            <div className="text-sm mt-1"><FundingLine card={card} /></div>
          </div>
          <div className="text-sm text-muted tnum">
            Posted {formatDate(opening.createdAt)} · {pluralize(applicantCount, "applicant")}
          </div>
        </div>
      </Card>

      <section>
        <SectionTitle>What the role is</SectionTitle>
        <p className="text-muted">{opening.summary}</p>
      </section>
      <section><SectionTitle>Compensation and working terms</SectionTitle><p className="whitespace-pre-line text-muted">{opening.compensationDetails || "Historical listing. Request complete written working terms before accepting any role."}</p></section>

      <section>
        <SectionTitle>What you would do</SectionTitle>
        <ul className="flex flex-col gap-1.5 text-sm">
          {opening.responsibilities.map((r) => (
            <li key={r} className="flex gap-2"><span className="text-muted">-</span>{r}</li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>What they are looking for</SectionTitle>
        <ul className="flex flex-col gap-1.5 text-sm">
          {opening.lookingFor.map((r) => (
            <li key={r} className="flex gap-2"><span className="text-muted">-</span>{r}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">No school, degree, or employer names are asked for. Bring what you have done.</p>
      </section>

      {venture ? (
        <section>
          <SectionTitle>The venture behind the role</SectionTitle>
          <Card>
            <div className="font-medium">{venture.name}</div>
            <p className="text-sm text-muted mt-1">{venture.oneLiner}</p>
            <p className="text-sm tnum mt-2">{venture.tractionSummary}</p>
            <div className="mt-3">
              <Link href={`/bench/${venture.slug}`} className="text-sm underline">See the venture, its milestones, and its terms</Link>
            </div>
          </Card>
        </section>
      ) : null}

      <section className="border-t border-line pt-6 flex flex-wrap items-center gap-3">
        {mine ? (
          <LinkButton href={`/jobs/${opening.id}/applicants`}>Review applicants</LinkButton>
        ) : existing ? (
          <Pill tone="blue">You applied. Status: {existing.status}</Pill>
        ) : opening.status !== "open" ? (
          <Pill tone="gray">Closed to applications</Pill>
        ) : user ? (
          <LinkButton href={`/jobs/${opening.id}/apply`}>Apply for this role</LinkButton>
        ) : (
          <LinkButton href={`/login?next=/jobs/${opening.id}/apply`}>Sign in to apply</LinkButton>
        )}
        <Link href="/jobs" className="text-sm underline text-muted">All roles</Link>
      </section>
    </div>
  );
}
