import { PairingMark } from "@/components/illustrations";
import Link from "next/link";

const COLUMNS: Array<[string, Array<[string, string]>]> = [
  ["Platform", [["/bench", "Bench"], ["/jobs", "Jobs"], ["/how-it-works", "How it works"], ["/builders", "For builders"], ["/counterparts", "For counterparts"], ["/investors", "For investors"]]],
  ["Counterpart", [["/about", "About"], ["/faq", "Questions"], ["/support", "Support"], ["/terms/operator_v1", "Agreement template"], ["/terms", "Platform terms"], ["/privacy", "Privacy"], ["/legal", "Agreement & policy drafts"], ["/login", "Sign in"]]],
];

export function Footer() {
  return (
    <footer className="border-t border-line mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <PairingMark size={28} />
            <span className="text-xl font-medium tracking-tight">Counterpart</span>
          </div>
          <p className="mt-4 text-sm text-muted">
            Commercial partnerships for the Philippines. Agree the work and cash compensation, keep a shared record, and make cofounder ownership a separate decision.
          </p>
        </div>
        {COLUMNS.map(([title, links]) => (
          <div key={title}>
            <div className="text-sm font-medium">{title}</div>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-muted hover:text-fg">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-xs text-muted flex flex-wrap gap-x-6 gap-y-2">
          <span>Counterpart 2026</span>
        </div>
      </div>
    </footer>
  );
}
