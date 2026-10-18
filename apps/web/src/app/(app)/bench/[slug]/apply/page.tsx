import { Notice, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { findApplication } from "@/lib/services/applications";
import { getVentureBySlug, isOnBench } from "@/lib/services/ventures";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = { title: "Apply" };
export const dynamic = "force-dynamic";

export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireRole("counterpart", `/bench/${slug}/apply`);
  const venture = (await getVentureBySlug(slug));
  if (!venture || !(await isOnBench(venture)) || (venture.status !== "development" && !venture.commercialTerms?.contractingParty)) notFound();
  if ((await findApplication(venture.id, user.id))) redirect(`/bench/${slug}`);


  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`Apply to ${venture.name}`}
        description={
          venture.status === "development" ? (
            <>This venture is in development and accepting applications. Responsibilities, hours, and paid terms must be agreed before work starts.</>
          ) : <>
            Paid commercial engagement,{" "}
            {venture.hoursPerWeek} hours a week.{" "}
            <Link href={`/bench/${slug}`} className="underline text-fg">
              Milestones and terms
            </Link>{" "}
            are on the venture page.
          </>
        }
      />
      {venture.builderId === user.id ? (
        <Notice tone="gray">You cannot apply to your own venture.</Notice>
      ) : (
        <>
          <ApplyForm slug={slug} terms={venture.commercialTerms} />
        </>
      )}
    </div>
  );
}
