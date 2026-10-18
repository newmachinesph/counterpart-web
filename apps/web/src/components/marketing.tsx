import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "./motion";

export function Section({ children, className = "", band = false, id }: { children: ReactNode; className?: string; band?: boolean; id?: string }) {
  return (
    <section id={id} className={band ? "band" : ""}>
      <div className={`max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 ${className}`}>{children}</div>
    </section>
  );
}

export function SectionHead({ title, children, aside }: { title: ReactNode; children?: ReactNode; aside?: ReactNode }) {
  return (
    <Reveal className="grid gap-6 md:grid-cols-12 md:gap-10 mb-10 sm:mb-14">
      <h2 className="display text-4xl sm:text-5xl md:text-6xl md:col-span-7">{title}</h2>
      <div className="md:col-span-5 flex flex-col gap-4 md:pt-3">
        {children ? <p className="text-lg text-muted max-w-md">{children}</p> : null}
        {aside}
      </div>
    </Reveal>
  );
}

const PILL = "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium border transition-[background-color,color,transform] active:scale-[0.98]";

export function Pill({ href, children, ghost = false }: { href: string; children: ReactNode; ghost?: boolean }) {
  const style = ghost ? "border-line-strong text-current hover:bg-surface" : "bg-brand text-white border-brand hover:bg-brand-ink";
  return (
    <Link href={href} className={`${PILL} ${style}`}>
      {children}
    </Link>
  );
}

export function BandPill({ href, children, ghost = false }: { href: string; children: ReactNode; ghost?: boolean }) {
  const style = ghost ? "border-line-strong text-current hover:bg-surface" : "bg-bg text-fg border-bg hover:opacity-90";
  return (
    <Link href={href} className={`${PILL} ${style}`}>
      {children}
    </Link>
  );
}

export function BigNumber({ value, label, sub }: { value: ReactNode; label: ReactNode; sub?: ReactNode }) {
  return (
    <div className="border-t border-line pt-4">
      <div className="display text-5xl sm:text-6xl tnum">{value}</div>
      <div className="mt-2 text-sm font-medium">{label}</div>
      {sub ? <div className="text-sm text-muted">{sub}</div> : null}
    </div>
  );
}

export function BrowserFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="frame rounded-2xl border border-line bg-bg text-fg overflow-hidden">
      <div className="flex items-center gap-2 px-3 h-10 border-b border-line text-xs text-muted bg-surface">
        <span className="flex gap-1.5">
          <i className="block h-2.5 w-2.5 rounded-full bg-line-strong" />
          <i className="block h-2.5 w-2.5 rounded-full bg-line-strong" />
          <i className="block h-2.5 w-2.5 rounded-full bg-line-strong" />
        </span>
        <span className="mx-auto rounded-md bg-bg border border-line px-3 py-0.5 tnum">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function Steps({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <ol className="grid gap-px bg-line border border-line rounded-2xl overflow-hidden sm:grid-cols-2 lg:grid-cols-5">
      {items.map(([title, body], i) => (
        <li key={title} className="bg-bg p-5 sm:p-6 flex flex-col gap-3 min-h-52">
          <span className="h-7 w-7 rounded-full bg-brand-soft text-brand text-xs font-medium flex items-center justify-center tnum">{i + 1}</span>
          <h3 className="text-lg font-medium leading-snug">{title}</h3>
          <p className="text-sm text-muted">{body}</p>
        </li>
      ))}
    </ol>
  );
}