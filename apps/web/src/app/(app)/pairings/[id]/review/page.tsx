import { Button, Field, INPUT_CLASS, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import type { Metadata } from "next";
import Link from "next/link";
import { requestReviewAction } from "../actions";
import { loadDashboardOr404 } from "../load";

export const metadata: Metadata = { title: "Request review" };
export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser(`/pairings/${id}/review`);
  const d = await loadDashboardOr404(user, id);
  const error = typeof query.error === "string" ? query.error : null;
  const other = user.id === d.pairing.builderId ? d.counterpart : d.builder;

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Request a review"
        description={
          <>
            Sends a note to {other.name} and the Counterpart admins. Use it when the numbers and the
            milestones disagree, or when something about the pairing needs a third look.{" "}
            <Link href={`/pairings/${id}`} className="underline text-fg">Back</Link>.
          </>
        }
      />
      {error ? <div className="mb-4"><Notice tone="red">{error}</Notice></div> : null}
      <form action={requestReviewAction} className="flex flex-col gap-5">
        <input type="hidden" name="pairingId" value={id} />
        <Field htmlFor="message" label="What needs reviewing">
          <textarea id="message" name="message" rows={5} required className={INPUT_CLASS} />
        </Field>
        <div>
          <Button type="submit">Send request</Button>
        </div>
      </form>
    </div>
  );
}