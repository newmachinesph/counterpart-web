import type { TermsTemplate } from "./types";

export type AgreementValues = Record<string, string>;

export const AGREEMENT_FIELDS = [
  { key: "CONTRACTING_PARTY", label: "Contracting person or company", group: "The parties", example: "Sample Venture Corporation" },
  { key: "TRIAL_DAYS", label: "Paid trial", group: "Duration", example: "45", type: "number", min: 1, max: 90, step: 1, unit: "days" },
  { key: "TERM_DAYS", label: "Total engagement term", group: "Duration", example: "180", type: "number", min: 1, max: 730, step: 1, unit: "days" },
  { key: "MONTHLY_FEE_PHP", label: "Monthly fee", group: "Compensation", example: "15000", type: "number", min: 0, max: 10000000, step: 0.01, unit: "PHP" },
  { key: "COMMISSION_RATE_PCT", label: "Commission rate", group: "Compensation", example: "10", type: "number", min: 0, max: 100, step: 0.01, unit: "%" },
  { key: "ELIGIBLE_REVENUE", label: "Eligible revenue and refund treatment", group: "Compensation", example: "Collected first-year subscription receipts, excluding VAT, refunds and chargebacks. Record later refunds as a documented adjustment.", multiline: true },
  { key: "ATTRIBUTION_RULE", label: "Deal attribution", group: "Compensation", example: "Register sourced deals before collection; builder reviews evidence of introduction and sale. Agree split credit in writing.", multiline: true },
  { key: "PAYMENT_DAYS", label: "Payment due", group: "Compensation", example: "15", type: "number", min: 1, max: 60, step: 1, unit: "days" },
  { key: "TAIL_DAYS", label: "Collections after departure", group: "Compensation", example: "90", type: "number", min: 0, max: 365, step: 1, unit: "days" },
  { key: "EXPENSE_POLICY", label: "Expense approvals", group: "Working terms", example: "Expenses require written approval before purchase; approved receipts are reimbursed within 15 days.", multiline: true },
  { key: "VENTURE_NAME", label: "Venture name", group: "The parties", example: "Sample Venture" },
  { key: "BUILDER_NAME", label: "Builder’s legal name", group: "The parties", example: "Alex Santos" },
  { key: "COUNTERPART_NAME", label: "Counterpart’s legal name", group: "The parties", example: "Sam Reyes" },
  { key: "OPERATOR_SCOPE", label: "Counterpart responsibilities", group: "The work", example: "Customer discovery, sales, onboarding, and weekly traction reporting.", multiline: true },
  { key: "BUILDER_COMMITMENTS", label: "Builder commitments", group: "The work", example: "Maintain the product, provide agreed access, and resolve product issues.", multiline: true },
  { key: "DISPUTE_PROCESS", label: "Dispute process and venue", group: "Review & signing", example: "To be agreed with Philippine counsel, including escalation, applicable law, and forum.", multiline: true },
] satisfies Array<{
  key: string; label: string; group: string; example: string;
  type?: string; multiline?: boolean; min?: number; max?: number; step?: number; unit?: string;
}>;

export function templateVariables(terms: TermsTemplate): string[] {
  return [...new Set(terms.sections.flatMap((section) =>
    Array.from(`${section.heading}\n${section.body}`.matchAll(/\[([A-Z][A-Z0-9_]*)\]/g), (match) => match[1]),
  ))];
}

export function fillAgreement(text: string, values: AgreementValues): string {
  return text.replace(/\[([A-Z][A-Z0-9_]*)\]/g, (placeholder, key: string) => values[key]?.trim() || placeholder);
}

export function agreementText(terms: TermsTemplate, values: AgreementValues): string {
  return [terms.title, "DRAFT · " + terms.id, terms.reviewNote,
    ...terms.sections.map((section, index) => `${index + 1}. ${fillAgreement(section.heading, values)}\n${fillAgreement(section.body, values)}`),
  ].join("\n\n");
}
