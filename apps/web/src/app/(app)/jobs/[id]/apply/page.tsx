import { Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { isPaid, payLabel } from "@/lib/domain/openings";
import { canManageOpening, findJobApplication, getOpeningCard } from "@/lib/services/openings";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApplyJobForm } from "./apply-job-form";

export const metadata: Metadata = { title: "Apply" };
export const dynamic = "force-dynamic";

export default async function ApplyJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/jobs/${id}/apply`);
  const card = (await getOpeningCard(id));
  if (!card) notFound();
  const { opening, venture } = card;
  if ((await findJobApplication(id, user.id))) redirect(`/jobs/${id}`);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`Apply: ${opening.title}`}
        description={
          <>
            {venture ? venture.name : "Counterpart"} · {payLabel(opening)} ·{" "}
            <Link href={`/jobs/${id}`} className="underline text-fg">the full role</Link>
          </>
        }
      />
      {(await canManageOpening(user, opening)) ? (
        <Notice tone="gray">You posted this role.</Notice>
      ) : opening.status !== "open" ? (
        <Notice tone="gray">This role is {opening.status}.</Notice>
      ) : (
        <ApplyJobForm openingId={id} paid={isPaid(opening)} />
      )}
    </div>
  );
}