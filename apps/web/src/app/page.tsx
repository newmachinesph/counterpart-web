import { Section, SectionHead, Pill } from "@/components/marketing";
import { PairingDiagram } from "@/components/illustrations";
import { Reveal, Stagger, Item, Words } from "@/components/motion";
import { VentureCard } from "@/components/venture-card";
import { listBench } from "@/lib/services/ventures";
export const dynamic="force-dynamic";
export default async function HomePage() {
 const bench=await listBench();const open=bench.filter(c=>c.venture.status==="published");const development=bench.filter(c=>c.venture.status==="development");
 return <>
  <Section><div className="max-w-5xl mx-auto text-center"><h1 className="display text-5xl sm:text-7xl md:text-8xl"><Words text="A working product meets the person who can sell it."/></h1><Reveal><p className="mt-7 mx-auto max-w-2xl text-lg sm:text-xl text-muted">Counterpart connects Filipino builders and commercial partners. Agree a paid trial, grow the business, and decide together what comes next.</p><div className="mt-9 flex flex-wrap justify-center gap-3"><Pill href="/bench">Explore the Bench</Pill><Pill href="/how-it-works" ghost>How it works</Pill></div></Reveal></div><Reveal className="mt-14"><div className="rounded-2xl border border-line p-5 sm:p-10 bg-surface max-w-5xl mx-auto"><PairingDiagram/><p className="text-sm text-muted text-center">An accepted agreement connects the work to the compensation.</p></div></Reveal></Section>
  <Section band><SectionHead title="Start with a clear agreement.">Cash compensation for commercial work. A separate decision for cofounder ownership.</SectionHead><div className="grid gap-6 md:grid-cols-3">{[
   ["A paid proving run","Agree the fee or commission, responsibilities, product support, and trial duration. Work starts when the counterpart accepts the saved offer."],
   ["A continuing partnership","Review results together. Continue on agreed terms, record attributable collections, and settle what is earned."],
   ["A deliberate cofounder grant","After the trial, equity requires a separate signed instrument, company approvals, and an agreed vesting schedule. A KPI never issues shares automatically."],
  ].map(([title,body])=><div key={title} className="rounded-2xl border border-line p-6"><h2 className="display text-3xl">{title}</h2><p className="mt-4 text-muted">{body}</p></div>)}</div></Section>
  <Section><SectionHead title="On the Bench." aside={<Pill href="/bench" ghost>View all ventures</Pill>}>{open.length > 0 && <>{open.length} open commercial {open.length === 1 ? "opportunity" : "opportunities"} · </>}{development.length} projects in development. Development projects also accept applications; paid terms must be agreed before work starts.</SectionHead><Stagger className="grid gap-4 md:grid-cols-3">{bench.slice(0,6).map(card=><Item key={card.venture.id}><VentureCard card={card}/></Item>)}</Stagger>{!bench.length && <p className="text-muted">The Bench is ready for its first published opportunity.</p>}</Section>
  <Section band><div className="max-w-3xl"><h2 className="display text-4xl sm:text-5xl">A record both sides can use.</h2><p className="mt-5 text-lg text-muted">Keep the accepted terms, reported performance, deal evidence, compensation claims, and payment acknowledgments together. Raise a review when something disagrees. Leaving ends future work; it does not erase accrued compensation.</p><div className="mt-8"><Pill href="/terms/operator_v1">Explore the agreement</Pill></div></div></Section>
 </>;
}
