import { LinkButton, PageHeader } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <PageHeader title="Not here" description="That page does not exist, or you cannot see it." />
      <LinkButton href="/bench" variant="secondary">
        Back to the Bench
      </LinkButton>
    </div>
  );
}