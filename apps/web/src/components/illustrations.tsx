"use client";

import type { VentureCategory } from "@/lib/domain/types";
import { motion, useReducedMotion } from "motion/react";

const EASE = [0.2, 0.7, 0.2, 1] as const;

// Hand-traced Counterpart mark: two complementary forms from the supplied artwork.
export function PairingMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 730 730" className={className} aria-hidden="true"><g transform="translate(45 0)"><path fill="var(--brand)" d="M212 12H477Q494 12 506 25L576 95Q592 111 576 127L519 184Q508 196 494 196H294C244 196 211 221 181 263C143 316 87 370 32 425Q12 443 12 423V206C12 100 104 12 212 12Z" /><path fill="var(--mango)" d="M171 361Q182 351 182 365V414C182 484 236 535 306 535H548C593 535 628 570 628 615V649C628 688 602 717 561 717H219C151 717 109 685 69 646C33 611 12 577 12 539C12 523 16 511 28 499Z" /></g></svg>;
}

// A pairing drawn as a path: builder on the left, four milestones along the
// way, equity on the right. The line draws itself when it scrolls into view.
export function PairingDiagram({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  const draw = {
    hidden: { pathLength: 0, opacity: 0 },
    show: { pathLength: 1, opacity: 1, transition: { duration: 1.6, ease: EASE } },
  };
  const pop = (delay: number) => ({
    hidden: { scale: 0, opacity: 0 },
    show: { scale: 1, opacity: 1, transition: { delay, duration: 0.4, ease: EASE } },
  });
  const stops = [
    { x: 250, label: "Accept offer", tone: "var(--green)" },
    { x: 400, label: "Paid trial", tone: "var(--green)" },
    { x: 550, label: "Review results", tone: "var(--brand)" },
    { x: 700, label: "Continue", tone: "var(--gray)" },
  ];
  return (
    <motion.svg
      viewBox="0 0 880 220"
      className={`w-full h-auto ${className}`}
      initial={reduced ? "show" : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
      aria-label="Builder and counterpart: accept offer, paid trial, review results, agree continuation"
      role="img"
    >
      <motion.path
        d="M110 110 C 170 110, 190 110, 250 110 S 340 110, 400 110 S 490 110, 550 110 S 640 110, 700 110 S 760 110, 790 110"
        fill="none"
        stroke="var(--rule-strong)"
        strokeWidth="2"
        strokeDasharray="6 8"
        variants={draw}
      />
      <motion.g variants={pop(0)}>
        <rect x="60" y="80" width="60" height="60" rx="18" fill="var(--brand)" />
        <text x="90" y="170" textAnchor="middle" fontSize="13" fill="var(--ink-soft)">Builder</text>
      </motion.g>
      {stops.map((s, i) => (
        <motion.g key={s.label} variants={pop(0.5 + i * 0.25)}>
          <circle cx={s.x} cy="110" r="14" fill="var(--paper)" stroke={s.tone} strokeWidth="3" />
          {i < 2 ? <circle cx={s.x} cy="110" r="6" fill={s.tone} /> : null}
          {i === 2 ? <circle cx={s.x} cy="110" r="6" fill={s.tone}><animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" /></circle> : null}
          <text x={s.x} y="150" textAnchor="middle" fontSize="12" fill="var(--ink-soft)">{s.label}</text>
          <text x={s.x} y="78" textAnchor="middle" fontSize="13" fill="var(--ink)" fontWeight="500">{["Terms", "Work", "Evidence", "Agreement"][i]}</text>
        </motion.g>
      ))}
      <motion.g variants={pop(1.6)}>
        <rect x="790" y="80" width="60" height="60" rx="18" fill="var(--mango)" />
        <text x="820" y="170" textAnchor="middle" fontSize="13" fill="var(--ink-soft)">Counterpart</text>
      </motion.g>
    </motion.svg>
  );
}

const GLYPHS: Record<VentureCategory, string> = {
  loyalty: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z",
  fintech: "M4 7h16v10H4zM4 11h16M8 15h3",
  saas: "M4 5h16v14H4zM4 9h16M7 7h.01M10 7h.01",
  marketplace: "M4 10l1-5h14l1 5M4 10v9h16v-9M4 10h16M10 19v-5h4v5",
  ecommerce: "M6 7h12l-1 12H7L6 7zM9 7a3 3 0 0 1 6 0",
  logistics: "M3 8h11v8H3zM14 11h4l3 3v2h-7zM6 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  other: "M12 4v16M4 12h16",
};

export function CategoryGlyph({ category, className = "" }: { category: VentureCategory; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={GLYPHS[category]} />
    </svg>
  );
}

// Three abstract panels for the rules section: a locked door with one open
// slot, a ledger grid with a gap, a shield that is not a shield.
export function RuleArt({ kind }: { kind: "door" | "ledger" | "evidence" | "keep" }) {
  if (kind === "ledger") {
    return (
      <svg viewBox="0 0 160 80" className="w-full h-auto" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x={6 + i * 15.5} y={i === 6 ? 20 : 20 + (i % 3) * 8} width="11" height={i === 6 ? 40 : 40 - (i % 3) * 8} rx="3" fill={i === 6 ? "none" : "var(--paper)"} stroke={i === 6 ? "var(--red)" : "none"} strokeDasharray={i === 6 ? "3 3" : undefined} opacity={i === 6 ? 1 : 0.9} />
        ))}
      </svg>
    );
  }
  if (kind === "door") {
    return (
      <svg viewBox="0 0 160 80" className="w-full h-auto" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <rect key={i} x={10 + i * 30} y="12" width="22" height="56" rx="5" fill={i === 2 ? "var(--brand)" : "none"} stroke="var(--paper)" strokeOpacity={i === 2 ? 0 : 0.5} strokeWidth="1.5" />
        ))}
      </svg>
    );
  }
  if (kind === "evidence") {
    return (
      <svg viewBox="0 0 160 80" className="w-full h-auto" aria-hidden="true">
        <path d="M14 58 L44 40 L74 48 L104 22 L146 30" fill="none" stroke="var(--mango)" strokeWidth="3" strokeLinecap="round" />
        {[
          [14, 58],
          [44, 40],
          [74, 48],
          [104, 22],
          [146, 30],
        ].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="4" fill="var(--paper)" />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 80" className="w-full h-auto" aria-hidden="true">
      <rect x="10" y="30" width="40" height="20" rx="6" fill="var(--green)" />
      <rect x="60" y="30" width="40" height="20" rx="6" fill="var(--green)" />
      <rect x="110" y="30" width="40" height="20" rx="6" fill="none" stroke="var(--paper)" strokeOpacity="0.5" strokeDasharray="3 3" />
    </svg>
  );
}