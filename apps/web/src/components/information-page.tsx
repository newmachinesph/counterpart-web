import { Section, Pill } from "./marketing";
import { Reveal } from "./motion";

export function InformationPage({ title, intro, sections, action = "Explore the Bench", href = "/bench" }: {
 title:string; intro:string; sections:{title:string;body:string}[]; action?:string; href?:string;
}) {
 return <><Section><div className="max-w-3xl"><h1 className="display text-5xl sm:text-7xl">{title}</h1><p className="mt-7 text-lg text-muted leading-relaxed">{intro}</p></div></Section>
  <Section className="pt-0 sm:pt-0"><div className="max-w-4xl divide-y divide-line border-y border-line">{sections.map(s=><Reveal key={s.title}><section className="grid gap-4 py-8 sm:grid-cols-[1fr_2fr]"><h2 className="display text-2xl sm:text-3xl">{s.title}</h2><p className="text-muted leading-relaxed whitespace-pre-line">{s.body}</p></section></Reveal>)}</div><div className="mt-10"><Pill href={href}>{action}</Pill></div></Section></>;
}
