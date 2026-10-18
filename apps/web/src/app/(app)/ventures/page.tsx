import { Button, Empty, LinkButton, Notice, PageHeader, Pill } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/store";
import { CATEGORY_LABELS } from "@/lib/format";
import { checkPublishable, hasLivePairing, listVenturesForBuilder } from "@/lib/services/ventures";
import type { Metadata } from "next";
import Link from "next/link";
import { publishAction, unpublishAction } from "./actions";

export const metadata: Metadata = { title: "Ventures" };
export const dynamic = "force-dynamic";

export default async function VenturesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("builder", "/ventures");
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const ventures = (await listVenturesForBuilder(user));
  const store = (await getStore());
  const isAdmin = user.roles.includes("admin");

  return (
    <div>
      <PageHeader
        title={isAdmin ? "All ventures" : "Your ventures"}
        description="A venture is a draft until its product URL answers and a screenshot is attached. Drafts never appear on the Bench."
        aside={<LinkButton href="/ventures/new">List a venture</LinkButton>}
      />
      {error ? (
        <div className="mb-4">
          <Notice tone="red">Could not publish: {error}</Notice>
        </div>
      ) : null}
      {ventures.length === 0 ? (
        <Empty>No ventures yet.</Empty>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {ventures.map(async (v) => {
            const check = (await checkPublishable(v));
            const live = (await hasLivePairing(v.id));
            const applicants = store.applications.filter((a) => a.ventureId === v.id);
            const pending = applicants.filter((a) => a.status === "submitted" || a.status === "shortlisted").length;
            const builder = store.users.find((u) => u.id === v.builderId);
            return (
              <li key={v.id} className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/bench/${v.slug}`} className="font-medium hover:underline">
                      {v.name}
                    </Link>
                    <Pill tone={v.status === "published" ? "green" : "gray"}>{v.status}</Pill>
                    {live ? <Pill tone="blue">Live pairing</Pill> : null}
                    <Pill tone="neutral">{CATEGORY_LABELS[v.category]}</Pill>
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {isAdmin && builder ? `${builder.name}. ` : ""}
                    {v.status === "draft" && !check.ok ? check.problems.join(". ") + "." : v.oneLiner}
                  </div>
                  <div className="mt-1 text-sm">
                    <Link href={`/ventures/${v.slug}/applications`} className="underline tnum">
                      {applicants.length} applications{pending ? `, ${pending} to review` : ""}
                    </Link>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {v.status === "published" ? (
                    <form action={unpublishAction}>
                      <input type="hidden" name="ventureId" value={v.id} />
                      <Button type="submit" variant="secondary">
                        Unpublish
                      </Button>
                    </form>
                  ) : (
                    <form action={publishAction}>
                      <input type="hidden" name="ventureId" value={v.id} />
                      <Button type="submit" variant="secondary">
                        Check and publish
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
