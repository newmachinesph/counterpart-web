"use client";

import { AnimatePresence, MotionConfig, animate, motion, useInView, useReducedMotion } from "motion/react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

const EASE = [0.2, 0.7, 0.2, 1] as const;

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export function Reveal({
  children,
  delay = 0,
  className = "",
  y = 18,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({ children, className = "", gap = 0.08 }: { children: ReactNode; className?: string; gap?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-8% 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

export function Item({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } }}
    >
      {children}
    </motion.div>
  );
}

// Kinetic headline: each word rises out of its own clip.
export function Words({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  const words = text.split(" ");
  return (
    <span className={className} aria-label={text}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span className="inline-block overflow-hidden align-bottom pb-[0.1em] -mb-[0.1em]">
            <motion.span
              className="inline-block"
              initial={reduced ? false : { y: "110%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: delay + i * 0.045 }}
            >
              {word}
            </motion.span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </span>
  );
}

export function Counter({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView || reduced) return;
    const controls = animate(0, value, {
      duration: 1.4,
      ease: EASE,
      onUpdate: (v) => setShown(v),
    });
    return () => controls.stop();
  }, [inView, value, reduced]);
  const text = new Intl.NumberFormat("en-PH", { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(reduced ? value : shown);
  return (
    <span ref={ref} className={`tnum ${className}`}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}

export interface BarDatum {
  label: string;
  value: number | null;
  open?: boolean;
  display?: string;
}

// Bars grow from the baseline when scrolled into view. Null is a missed week.
export function Bars({ data, caption }: { data: BarDatum[]; caption?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value ?? 0));
  return (
    <div>
      <motion.div
        className="flex items-end gap-1.5 sm:gap-2 h-36 sm:h-40 border-b border-line"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-10% 0px" }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        {data.map((d) => {
          if (d.value === null) {
            return (
              <div key={d.label} className="flex-1 h-full flex flex-col justify-end" title="No entry">
                <div className="h-full rounded-t-md border border-dashed border-line-strong" />
              </div>
            );
          }
          const pct = Math.max(3, Math.round((d.value / max) * 100));
          return (
            <div key={d.label} className="flex-1 h-full flex flex-col justify-end">
              <motion.div
                className="text-[10px] text-muted tnum text-center mb-1 truncate"
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: 0.5 } } }}
              >
                {d.display ?? d.value}
              </motion.div>
              <motion.div
                className={`rounded-t-md origin-bottom ${d.open ? "bg-brand" : "bg-fg"}`}
                style={{ height: `${pct}%` }}
                variants={{ hidden: { scaleY: 0 }, show: { scaleY: 1, transition: { duration: 0.7, ease: EASE } } }}
              />
            </div>
          );
        })}
      </motion.div>
      <div className="flex gap-1.5 sm:gap-2 mt-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex-1 text-[10px] text-muted tnum text-center truncate">
            {d.label}
          </div>
        ))}
      </div>
      {caption ? <p className="mt-2 text-xs text-muted">{caption}</p> : null}
    </div>
  );
}

export function Accordion({ items }: { items: Array<[string, string]> }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map(([q, a], i) => {
        const isOpen = open === i;
        return (
          <div key={q}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full py-5 flex items-start justify-between gap-6 text-left text-base sm:text-lg font-medium"
            >
              <span>{q}</span>
              <motion.span
                className="shrink-0 h-6 w-6 rounded-full border border-line-strong flex items-center justify-center text-muted text-lg leading-none"
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  key="body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="overflow-hidden"
                >
                  <p className="pb-5 text-muted max-w-2xl">{a}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export function Hover({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} whileHover={{ y: -3 }} transition={{ duration: 0.25, ease: EASE }}>
      {children}
    </motion.div>
  );
}