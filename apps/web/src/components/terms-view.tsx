import type { TermsTemplate } from "@/lib/domain/types";
import { Notice, PageHeader } from "./ui";

/**
 * Renders a terms template. Placeholders stay visibly in brackets.
 * Swap the template record; nothing here is binding.
 */
export function TermsView({ terms, context }: { terms: TermsTemplate; context?: React.ReactNode }) {
  return (
    <div className="max-w-2xl">
      <PageHeader title={terms.title} description={context} />
      <div className="mb-6">
        <Notice tone="red">{terms.reviewNote}</Notice>
      </div>
      <ol className="flex flex-col gap-5">
        {terms.sections.map((s, i) => (
          <li key={s.heading} className="border-t border-line pt-4">
            <h2 className="font-medium">
              <span className="text-muted tnum mr-2">{i + 1}.</span>
              {s.heading}
            </h2>
            <p className="mt-1.5 text-sm text-muted whitespace-pre-line">{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-xs text-muted">
        Template id {terms.id}. Bracketed text is a placeholder to be filled by counsel.
      </p>
    </div>
  );
}
