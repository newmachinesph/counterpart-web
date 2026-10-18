import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type Tone = "green" | "blue" | "gray" | "red" | "neutral";

const PILL_TONES: Record<Tone, string> = {
  green: "bg-green-bg text-green",
  blue: "bg-blue-bg text-blue",
  gray: "bg-gray-bg text-gray",
  red: "bg-red-bg text-red",
  neutral: "border border-line text-muted",
};

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${PILL_TONES[tone]}`}>
      {children}
    </span>
  );
}

const BUTTON_BASE =
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium border transition-[background-color,color,opacity,transform] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
const BUTTON_VARIANTS = {
  primary: "bg-brand text-white border-brand hover:bg-brand-ink",
  secondary: "bg-bg text-fg border-line-strong hover:bg-surface",
  danger: "bg-bg text-red border-line-strong hover:bg-red-bg",
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`} {...props} />;
}

export function LinkButton({ variant = "primary", className = "", href, children }: { variant?: ButtonVariant; className?: string; href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-bg p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function PageHeader({ title, description, aside }: { title: ReactNode; description?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-8 sm:mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-2xl break-words">
        <h1 className="display text-4xl sm:text-5xl">{title}</h1>
        {description ? <p className="mt-3 text-muted text-lg">{description}</p> : null}
      </div>
      {aside ? <div className="flex flex-wrap gap-2 shrink-0">{aside}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-3">
      <h2 className="text-lg font-medium">{children}</h2>
      {aside ? <div className="text-sm text-muted">{aside}</div> : null}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  const color = tone === "green" ? "text-green" : tone === "red" ? "text-red" : tone === "blue" ? "text-blue" : "";
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-3xl sm:text-4xl font-medium tnum tracking-tight ${color}`}>{value}</div>
      {sub ? <div className="mt-1 text-sm text-muted">{sub}</div> : null}
    </div>
  );
}

export const INPUT_CLASS =
  "w-full rounded-xl border border-line-strong bg-bg px-3.5 py-2.5 text-base sm:text-sm text-fg focus:outline-none focus:border-brand";

export function Field({ label, hint, error, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? <p className="text-sm text-red">{error}</p> : hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function Notice({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const styles: Record<Tone, string> = {
    green: "border-green/30 text-green bg-green-bg",
    blue: "border-blue/30 text-blue bg-blue-bg",
    gray: "border-line text-muted bg-surface",
    red: "border-red/30 text-red bg-red-bg",
    neutral: "border-line text-fg bg-surface",
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>;
}

export function Definition({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="tnum">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line-strong p-10 text-center text-sm text-muted">{children}</div>;
}
