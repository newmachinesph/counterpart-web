import Link from "next/link";
import { LEGAL_DRAFT_DATE, legalDocuments } from "@/lib/legal/documents";

export const metadata = { title: "Agreement and policy drafts" };

export default function LegalLibraryPage() {
  return <>
    <header className="max-w-3xl">
      <p className="text-sm text-brand">Counterpart / Agreements & policies</p>
      <h1 className="display mt-5 text-5xl sm:text-6xl">Clear terms for working together.</h1>
      <p className="mt-6 text-lg leading-relaxed text-muted">A review library for the platform, paid work and a separate cofounder decision. Each document explains who it is for and what needs to be completed.</p>
    </header>
    <aside className="my-10 rounded-xl border border-line bg-mango-soft p-5 sm:p-6" aria-label="Draft status">
      <p className="font-medium">Drafts for review · {LEGAL_DRAFT_DATE}</p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed">These proposed documents are not in force or available for acceptance. Operator details and legal review are still required. Existing accepted agreements keep their recorded terms.</p>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm"><Link className="underline" href="/terms">Current platform terms</Link><Link className="underline" href="/privacy">Current privacy notice</Link><Link className="underline" href="/terms/operator_v1">Current engagement template</Link></div>
    </aside>
    <section aria-label="Draft documents" className="grid gap-x-10 md:grid-cols-2">
      {legalDocuments.map((document) => <article key={document.slug} className="border-t border-line py-7">
        <p className="text-xs text-muted">{document.audience}</p>
        <h2 className="display mt-3 text-3xl"><Link className="hover:text-brand" href={`/legal/${document.slug}`}>{document.title}</Link></h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">{document.summary}</p>
        <Link className="mt-5 inline-block text-sm text-brand underline" href={`/legal/${document.slug}`}>Read draft <span aria-hidden="true">↗</span></Link>
      </article>)}
    </section>
    <p className="mt-8 max-w-3xl border-t border-line pt-6 text-sm leading-relaxed text-muted">Payments stay external. Cofounder documents are signed and held outside Counterpart. Platform records help the parties keep track of their agreements; they do not replace corporate approvals or legal advice.</p>
  </>;
}
