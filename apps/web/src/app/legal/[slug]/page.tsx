import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLegalDocument, legalDocuments, LEGAL_DRAFT_DATE, LEGAL_DRAFT_NOTICE } from "@/lib/legal/documents";

export function generateStaticParams() {
  return legalDocuments.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const document = getLegalDocument((await params).slug);
  return { title: document ? `${document.title} — draft` : "Document not found" };
}

export default async function LegalDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const document = getLegalDocument((await params).slug);
  if (!document) notFound();
  return <>
    <Link className="text-sm underline" href="/legal">All agreement and policy drafts</Link>
    <header className="mt-8 max-w-3xl">
      <p className="text-sm text-brand">{document.audience}</p>
      <h1 className="display mt-4 text-4xl sm:text-6xl">{document.title}</h1>
      <p className="mt-5 text-lg leading-relaxed text-muted">{document.summary}</p>
      <p className="mt-5 break-words text-xs text-muted">{document.version} · Prepared {LEGAL_DRAFT_DATE} · Not in force</p>
    </header>
    <aside className="my-8 rounded-xl border border-line bg-mango-soft p-5" aria-label="Draft status and review requirements">
      <p className="max-w-3xl text-sm leading-relaxed">{LEGAL_DRAFT_NOTICE}</p>
      <h2 className="mt-4 text-sm font-medium">Before adoption</h2>
      <ul className="mt-2 max-w-3xl list-disc space-y-2 pl-5 text-sm leading-relaxed">{document.reviewPoints.map((point) => <li key={point}>{point}</li>)}</ul>
      <a className="mt-5 inline-block text-sm underline" href={`/legal/${document.slug}/download`} download={`${document.version}.md`}>Download draft (.md)</a>
    </aside>
    <div className="grid items-start gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
      <nav aria-label="Document contents" className="border-y border-line py-5 lg:sticky lg:top-6">
        <p className="text-sm font-medium">In this document</p>
        <ol className="mt-4 space-y-3 text-sm text-muted">{document.sections.map((section, index) => <li key={section.title}><a className="hover:text-brand hover:underline" href={`#section-${index + 1}`}>{index + 1}. {section.title}</a></li>)}</ol>
      </nav>
      <article className="min-w-0 max-w-3xl">
        {document.sections.map((section, index) => <section key={section.title} id={`section-${index + 1}`} className="scroll-mt-6 border-t border-line py-7 first:pt-5">
          <h2 className="text-xl font-medium"><span className="mr-2 text-muted">{index + 1}.</span>{section.title}</h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-muted [overflow-wrap:anywhere]">{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
        </section>)}
        <aside className="border-t border-line pt-7">
          <h2 className="text-lg font-medium">Research references</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">These references informed preparation; they do not certify this draft or replace advice on the actual arrangement.</p>
          <ul className="mt-4 space-y-3 text-sm">{document.sources.map((source) => <li key={source.url}><a className="underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>
        </aside>
      </article>
    </div>
  </>;
}
